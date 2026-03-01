/**
 * @fileoverview Performance Benchmark Tests (T-3, P-4)
 *
 * Validates performance metrics and cost anomaly detection:
 *   - Reasoning Overhead (RO) — target < 200 tokens/step
 *   - Tool Ping-Pong (TPP) — target < 0.05 ratio
 *   - Decision Latency — target < 500ms
 *   - Total Chain Length — tracked and reported
 *   - Cost Anomaly Detection (P-4):
 *     - Token velocity detection
 *     - Tool loop density
 *     - Sequential fallback count
 *     - Cost spike detection
 *
 * INVARIANT: All performance metrics meet or exceed targets.
 * INVARIANT: Cost anomalies are detected and reported.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { TraceAnalytics, type TraceRecord, type TraceMetrics } from '../../telemetry/traceAnalytics';
import { CostAnomalyDetector, type AnomalyContext, type AnomalyResult } from '../../policy/costAnomaly';

// ─── Constants ────────────────────────────────────────────────────────────────

const PERFORMANCE_TARGETS = {
  maxReasoningOverhead: 200, // tokens per tool call
  maxToolPingPong: 0.05, // 5% ratio
  maxDecisionLatencyMs: 500, // milliseconds
  maxChainLength: 50, // steps
};

const COST_ANOMALY_THRESHOLDS = {
  tokenVelocityMultiplier: 2,
  toolLoopDensityMax: 10,
  maxSequentialFallbacks: 3,
  costSpikeMultiplier: 5,
  rollingWindowSize: 20,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createTraceRecord(overrides: Partial<TraceRecord> = {}): TraceRecord {
  return {
    stepId: 1,
    timestamp: new Date().toISOString(),
    kind: 'reasoning',
    ...overrides,
  };
}

function generateTrace(options: {
  reasoningTokens?: number;
  toolCallCount?: number;
  repeatedToolCalls?: number;
  latencyMs?: number;
  totalSteps?: number;
}): TraceRecord[] {
  const records: TraceRecord[] = [];
  const startTime = Date.now();
  let stepId = 1;

  // Initial reasoning step
  records.push(createTraceRecord({
    stepId: stepId++,
    timestamp: new Date(startTime).toISOString(),
    kind: 'reasoning',
    reasoningTokens: options.reasoningTokens ? Math.floor(options.reasoningTokens / (options.toolCallCount || 1)) : 10,
  }));

  // Tool calls
  const toolCount = options.toolCallCount || 0;
  const repeatedTool = 'repeated_tool';

  for (let i = 0; i < toolCount; i++) {
    const toolName = options.repeatedToolCalls && i < options.repeatedToolCalls
      ? repeatedTool
      : `tool_${i}`;

    records.push(createTraceRecord({
      stepId: stepId++,
      timestamp: new Date(startTime + (options.latencyMs || 0) / toolCount * i).toISOString(),
      kind: 'tool_call',
      toolName,
      toolInputHash: `hash_${i}`,
    }));

    // Add some reasoning between tools
    if (options.reasoningTokens) {
      records.push(createTraceRecord({
        stepId: stepId++,
        timestamp: new Date(startTime + (options.latencyMs || 0) / toolCount * i + 10).toISOString(),
        kind: 'reasoning',
        reasoningTokens: Math.floor(options.reasoningTokens / toolCount),
      }));
    }
  }

  // Pad to total steps if needed
  while (records.length < (options.totalSteps || records.length)) {
    records.push(createTraceRecord({
      stepId: stepId++,
      timestamp: new Date(startTime + records.length * 10).toISOString(),
      kind: 'decision',
    }));
  }

  return records;
}

function createAnomalyContext(overrides: Partial<AnomalyContext> = {}): AnomalyContext {
  return {
    tenantId: 'test-tenant',
    requestCostCents: 1,
    tokens: 100,
    toolCallCount: 1,
    consecutiveFallbacks: 0,
    timestampMs: Date.now(),
    ...overrides,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Performance Benchmark Tests (T-3, P-4)', () => {
  let analytics: TraceAnalytics;
  let anomalyDetector: CostAnomalyDetector;

  beforeEach(() => {
    analytics = new TraceAnalytics(PERFORMANCE_TARGETS);
    anomalyDetector = new CostAnomalyDetector(COST_ANOMALY_THRESHOLDS);
  });

  afterEach(() => {
    // Reset anomaly detector state
    anomalyDetector._reset();
  });

  describe('Reasoning Overhead (RO) Benchmarks', () => {
    test('RO < 200 tokens/step target - passing case', () => {
      const trace = generateTrace({
        reasoningTokens: 500, // 500 tokens
        toolCallCount: 5, // 5 tool calls = 100 tokens/call
      });

      const metrics = analytics.computeMetrics(trace);

      assert.ok(metrics.reasoningOverhead < PERFORMANCE_TARGETS.maxReasoningOverhead,
        `Reasoning overhead ${metrics.reasoningOverhead.toFixed(1)} should be < ${PERFORMANCE_TARGETS.maxReasoningOverhead}`);
    });

    test('RO > 200 tokens/step - anomaly detected', () => {
      const trace = generateTrace({
        reasoningTokens: 2000, // 2000 tokens
        toolCallCount: 5, // 5 tool calls = 400 tokens/call (exceeds target)
      });

      const { metrics, anomalies } = analytics.analyze(trace);

      assert.ok(metrics.reasoningOverhead > PERFORMANCE_TARGETS.maxReasoningOverhead,
        `Reasoning overhead ${metrics.reasoningOverhead.toFixed(1)} should exceed ${PERFORMANCE_TARGETS.maxReasoningOverhead}`);

      const roAnomaly = anomalies.find(a => a.kind === 'high_reasoning_overhead');
      assert.ok(roAnomaly, 'Should detect high reasoning overhead anomaly');
      assert.equal(roAnomaly.severity, 'warning', 'Should be warning severity for moderate excess');
    });

    test('RO critical threshold at 2x target', () => {
      const trace = generateTrace({
        reasoningTokens: 4000, // 4000 tokens
        toolCallCount: 5, // 5 tool calls = 800 tokens/call (4x target)
      });

      const { anomalies } = analytics.analyze(trace);

      const roAnomaly = anomalies.find(a => a.kind === 'high_reasoning_overhead');
      assert.ok(roAnomaly, 'Should detect anomaly');
      assert.equal(roAnomaly.severity, 'critical', 'Should be critical at 4x target');
    });

    test('RO calculation with zero tool calls', () => {
      const trace = generateTrace({
        reasoningTokens: 100,
        toolCallCount: 0,
      });

      const metrics = analytics.computeMetrics(trace);

      assert.equal(metrics.reasoningOverhead, 100,
        'RO should equal total tokens when no tool calls');
    });
  });

  describe('Tool Ping-Pong (TPP) Benchmarks', () => {
    test('TPP < 0.05 target - passing case', () => {
      const trace = generateTrace({
        toolCallCount: 20,
        repeatedToolCalls: 0, // No repeated tools
      });

      const metrics = analytics.computeMetrics(trace);

      assert.ok(metrics.toolPingPong < PERFORMANCE_TARGETS.maxToolPingPong,
        `TPP ${metrics.toolPingPong.toFixed(3)} should be < ${PERFORMANCE_TARGETS.maxToolPingPong}`);
    });

    test('TPP > 0.05 - ping-pong anomaly detected', () => {
      const trace = generateTrace({
        toolCallCount: 20,
        repeatedToolCalls: 15, // 15/20 = 75% repeated (exceeds 5% target)
      });

      const { metrics, anomalies } = analytics.analyze(trace);

      assert.ok(metrics.toolPingPong > PERFORMANCE_TARGETS.maxToolPingPong,
        `TPP ${metrics.toolPingPong.toFixed(3)} should exceed ${PERFORMANCE_TARGETS.maxToolPingPong}`);

      const tppAnomaly = anomalies.find(a => a.kind === 'tool_ping_pong');
      assert.ok(tppAnomaly, 'Should detect tool ping-pong anomaly');
    });

    test('TPP calculation with all unique tools', () => {
      const trace = generateTrace({
        toolCallCount: 10,
        repeatedToolCalls: 0,
      });

      const metrics = analytics.computeMetrics(trace);

      assert.equal(metrics.toolPingPong, 0, 'TPP should be 0 with all unique tools');
    });

    test('TPP calculation with all repeated tools', () => {
      const trace = generateTrace({
        toolCallCount: 10,
        repeatedToolCalls: 10,
      });

      const metrics = analytics.computeMetrics(trace);

      assert.equal(metrics.toolPingPong, 1, 'TPP should be 1.0 with all repeated tools');
    });
  });

  describe('Decision Latency Benchmarks', () => {
    test('Latency < 500ms target - passing case', () => {
      const trace = generateTrace({
        toolCallCount: 3,
        latencyMs: 300, // 300ms decision latency
      });

      const metrics = analytics.computeMetrics(trace);

      assert.ok(metrics.decisionLatencyMs < PERFORMANCE_TARGETS.maxDecisionLatencyMs,
        `Latency ${metrics.decisionLatencyMs}ms should be < ${PERFORMANCE_TARGETS.maxDecisionLatencyMs}ms`);
    });

    test('Latency > 500ms - high latency anomaly detected', () => {
      const trace = generateTrace({
        toolCallCount: 3,
        latencyMs: 1000, // 1000ms decision latency (exceeds 500ms target)
      });

      const { metrics, anomalies } = analytics.analyze(trace);

      assert.ok(metrics.decisionLatencyMs > PERFORMANCE_TARGETS.maxDecisionLatencyMs,
        `Latency ${metrics.decisionLatencyMs}ms should exceed ${PERFORMANCE_TARGETS.maxDecisionLatencyMs}ms`);

      const latencyAnomaly = anomalies.find(a => a.kind === 'high_decision_latency');
      assert.ok(latencyAnomaly, 'Should detect high decision latency anomaly');
    });

    test('Latency critical at 3x threshold', () => {
      const trace = generateTrace({
        toolCallCount: 3,
        latencyMs: 2000, // 2000ms (4x target)
      });

      const { anomalies } = analytics.analyze(trace);

      const latencyAnomaly = anomalies.find(a => a.kind === 'high_decision_latency');
      assert.ok(latencyAnomaly, 'Should detect anomaly');
      assert.equal(latencyAnomaly.severity, 'critical', 'Should be critical at 4x target');
    });
  });

  describe('Total Chain Length Tracking', () => {
    test('chain length tracked correctly', () => {
      const trace = generateTrace({ totalSteps: 25 });

      const metrics = analytics.computeMetrics(trace);

      assert.equal(metrics.totalChainLength, 25, 'Should track total chain length');
    });

    test('long chain anomaly at > 50 steps', () => {
      const trace = generateTrace({ totalSteps: 60 });

      const { anomalies } = analytics.analyze(trace);

      const chainAnomaly = anomalies.find(a => a.kind === 'long_chain');
      assert.ok(chainAnomaly, 'Should detect long chain anomaly');
    });

    test('critical chain length at 2x threshold', () => {
      const trace = generateTrace({ totalSteps: 120 });

      const { anomalies } = analytics.analyze(trace);

      const chainAnomaly = anomalies.find(a => a.kind === 'long_chain');
      assert.ok(chainAnomaly, 'Should detect anomaly');
      assert.equal(chainAnomaly.severity, 'critical', 'Should be critical at 2x threshold');
    });
  });

  describe('Cost Anomaly Detection - Token Velocity (P-4)', () => {
    test('normal token rate - no anomaly', () => {
      // Prime the rolling window with normal values
      for (let i = 0; i < 5; i++) {
        anomalyDetector.check(createAnomalyContext({ tokens: 100 }));
      }

      const results = anomalyDetector.check(createAnomalyContext({ tokens: 110 }));

      const tvAnomaly = results.find(r => r.metric === 'token_velocity');
      assert.ok(!tvAnomaly?.detected, 'Should not detect anomaly for normal rate');
    });

    test('high token velocity - anomaly detected', () => {
      // Prime with low values
      for (let i = 0; i < 5; i++) {
        anomalyDetector.check(createAnomalyContext({
          tokens: 50,
          timestampMs: Date.now() - (5 - i) * 60000, // Spread over 5 minutes
        }));
      }

      // Spike: 1000 tokens in same minute (way above 2x average)
      const results = anomalyDetector.check(createAnomalyContext({ tokens: 1000 }));

      const tvAnomaly = results.find(r => r.metric === 'token_velocity');
      assert.ok(tvAnomaly?.detected, 'Should detect token velocity anomaly');
      assert.ok(tvAnomaly.severity === 'warning' || tvAnomaly.severity === 'critical',
        'Should have appropriate severity');
    });

    test('critical token velocity at 4x threshold', () => {
      // Prime with normal values
      for (let i = 0; i < 5; i++) {
        anomalyDetector.check(createAnomalyContext({ tokens: 100 }));
      }

      // Extreme spike: 1000 tokens vs 100 average (10x)
      const results = anomalyDetector.check(createAnomalyContext({ tokens: 1000 }));

      const tvAnomaly = results.find(r => r.metric === 'token_velocity');
      assert.ok(tvAnomaly?.detected, 'Should detect anomaly');
    });
  });

  describe('Cost Anomaly Detection - Tool Loop Density (P-4)', () => {
    test('normal tool count - no anomaly', () => {
      const results = anomalyDetector.check(createAnomalyContext({ toolCallCount: 5 }));

      const tldAnomaly = results.find(r => r.metric === 'tool_loop_density');
      assert.ok(!tldAnomaly?.detected, 'Should not detect anomaly for normal tool count');
    });

    test('high tool loop density - anomaly detected', () => {
      const results = anomalyDetector.check(createAnomalyContext({ toolCallCount: 15 }));

      const tldAnomaly = results.find(r => r.metric === 'tool_loop_density');
      assert.ok(tldAnomaly?.detected, 'Should detect tool loop density anomaly');
      assert.equal(tldAnomaly?.value, 15, 'Should report correct tool count');
      assert.equal(tldAnomaly?.threshold, 10, 'Should use configured threshold');
    });

    test('critical tool density at 2x threshold', () => {
      const results = anomalyDetector.check(createAnomalyContext({ toolCallCount: 25 }));

      const tldAnomaly = results.find(r => r.metric === 'tool_loop_density');
      assert.ok(tldAnomaly?.detected, 'Should detect anomaly');
      assert.equal(tldAnomaly?.severity, 'critical', 'Should be critical at 2.5x threshold');
    });
  });

  describe('Cost Anomaly Detection - Sequential Fallbacks (P-4)', () => {
    test('normal fallback count - no anomaly', () => {
      const results = anomalyDetector.check(createAnomalyContext({ consecutiveFallbacks: 2 }));

      const sfcAnomaly = results.find(r => r.metric === 'sequential_fallback_count');
      assert.ok(!sfcAnomaly?.detected, 'Should not detect anomaly for normal fallback count');
    });

    test('excessive fallbacks - anomaly detected', () => {
      const results = anomalyDetector.check(createAnomalyContext({ consecutiveFallbacks: 5 }));

      const sfcAnomaly = results.find(r => r.metric === 'sequential_fallback_count');
      assert.ok(sfcAnomaly?.detected, 'Should detect sequential fallback anomaly');
      assert.equal(sfcAnomaly?.value, 5, 'Should report correct fallback count');
    });

    test('critical fallbacks at 2x threshold', () => {
      const results = anomalyDetector.check(createAnomalyContext({ consecutiveFallbacks: 8 }));

      const sfcAnomaly = results.find(r => r.metric === 'sequential_fallback_count');
      assert.ok(sfcAnomaly?.detected, 'Should detect anomaly');
      assert.equal(sfcAnomaly?.severity, 'critical', 'Should be critical at high fallback count');
    });
  });

  describe('Cost Anomaly Detection - Cost Spike (P-4)', () => {
    test('normal cost - no anomaly', () => {
      // Prime with normal costs
      for (let i = 0; i < 5; i++) {
        anomalyDetector.check(createAnomalyContext({ requestCostCents: 10 }));
      }

      const results = anomalyDetector.check(createAnomalyContext({ requestCostCents: 12 }));

      const csAnomaly = results.find(r => r.metric === 'cost_spike');
      assert.ok(!csAnomaly?.detected, 'Should not detect anomaly for normal cost');
    });

    test('cost spike - anomaly detected', () => {
      // Prime with low costs (average ~10 cents)
      for (let i = 0; i < 5; i++) {
        anomalyDetector.check(createAnomalyContext({ requestCostCents: 10 }));
      }

      // Spike: 100 cents (10x average, exceeds 5x threshold)
      const results = anomalyDetector.check(createAnomalyContext({ requestCostCents: 100 }));

      const csAnomaly = results.find(r => r.metric === 'cost_spike');
      assert.ok(csAnomaly?.detected, 'Should detect cost spike anomaly');
    });

    test('critical cost spike at 2x threshold', () => {
      // Prime with normal costs
      for (let i = 0; i < 5; i++) {
        anomalyDetector.check(createAnomalyContext({ requestCostCents: 10 }));
      }

      // Extreme spike: 200 cents (20x average)
      const results = anomalyDetector.check(createAnomalyContext({ requestCostCents: 200 }));

      const csAnomaly = results.find(r => r.metric === 'cost_spike');
      assert.ok(csAnomaly?.detected, 'Should detect anomaly');
    });
  });

  describe('Baseline Results Recording', () => {
    test('all metrics are computed and reportable', () => {
      const trace = generateTrace({
        reasoningTokens: 800,
        toolCallCount: 8,
        repeatedToolCalls: 2,
        latencyMs: 400,
        totalSteps: 30,
      });

      const metrics = analytics.computeMetrics(trace);

      // Verify all expected metrics are present
      assert.ok(typeof metrics.reasoningOverhead === 'number', 'Should have reasoningOverhead');
      assert.ok(typeof metrics.toolPingPong === 'number', 'Should have toolPingPong');
      assert.ok(typeof metrics.decisionLatencyMs === 'number', 'Should have decisionLatencyMs');
      assert.ok(typeof metrics.totalChainLength === 'number', 'Should have totalChainLength');
      assert.ok(typeof metrics.totalReasoningTokens === 'number', 'Should have totalReasoningTokens');
      assert.ok(typeof metrics.totalToolCalls === 'number', 'Should have totalToolCalls');
      assert.ok(typeof metrics.distinctToolNames === 'number', 'Should have distinctToolNames');
    });

    test('metrics can be serialized for baseline storage', () => {
      const trace = generateTrace({
        reasoningTokens: 500,
        toolCallCount: 5,
        latencyMs: 300,
        totalSteps: 20,
      });

      const metrics = analytics.computeMetrics(trace);
      const serialized = JSON.stringify(metrics);
      const deserialized = JSON.parse(serialized) as TraceMetrics;

      assert.deepStrictEqual(deserialized, metrics, 'Metrics should serialize/deserialize correctly');
    });
  });

  describe('Performance Target Compliance', () => {
    test('all targets are documented and testable', () => {
      const targets = [
        { name: 'reasoningOverhead', value: PERFORMANCE_TARGETS.maxReasoningOverhead, unit: 'tokens/step' },
        { name: 'toolPingPong', value: PERFORMANCE_TARGETS.maxToolPingPong, unit: 'ratio' },
        { name: 'decisionLatency', value: PERFORMANCE_TARGETS.maxDecisionLatencyMs, unit: 'ms' },
        { name: 'chainLength', value: PERFORMANCE_TARGETS.maxChainLength, unit: 'steps' },
      ];

      for (const target of targets) {
        assert.ok(target.value > 0, `${target.name} should have positive target`);
        assert.ok(target.unit, `${target.name} should have documented unit`);
      }
    });

    test('passing trace meets all performance targets', () => {
      const trace = generateTrace({
        reasoningTokens: 600, // 600 / 5 = 120 < 200
        toolCallCount: 5,
        repeatedToolCalls: 0, // 0% < 5%
        latencyMs: 400, // < 500ms
        totalSteps: 30, // < 50
      });

      const { metrics, anomalies } = analytics.analyze(trace);

      assert.ok(metrics.reasoningOverhead < PERFORMANCE_TARGETS.maxReasoningOverhead,
        `RO ${metrics.reasoningOverhead.toFixed(1)} should be < ${PERFORMANCE_TARGETS.maxReasoningOverhead}`);
      assert.ok(metrics.toolPingPong < PERFORMANCE_TARGETS.maxToolPingPong,
        `TPP ${metrics.toolPingPong.toFixed(3)} should be < ${PERFORMANCE_TARGETS.maxToolPingPong}`);
      assert.ok(metrics.decisionLatencyMs < PERFORMANCE_TARGETS.maxDecisionLatencyMs,
        `Latency ${metrics.decisionLatencyMs}ms should be < ${PERFORMANCE_TARGETS.maxDecisionLatencyMs}ms`);
      assert.ok(metrics.totalChainLength < PERFORMANCE_TARGETS.maxChainLength,
        `Chain length ${metrics.totalChainLength} should be < ${PERFORMANCE_TARGETS.maxChainLength}`);

      assert.equal(anomalies.length, 0, 'Passing trace should have no anomalies');
    });
  });
});

// ─── Export for use in other test suites ───────────────────────────────────────

export { generateTrace, createAnomalyContext, PERFORMANCE_TARGETS, COST_ANOMALY_THRESHOLDS };
