/**
 * @fileoverview Trace Analytics — agent reasoning trace analysis.
 *
 * Implements the metrics defined in docs/TRACE_ANALYTICS.md:
 *   - Reasoning Overhead (RO): reasoning tokens / tool call count
 *   - Tool Ping-Pong (TPP): repeated tool methods / total actions
 *   - Decision Latency: time from request to first tool call (ms)
 *   - Total Chain Length: number of steps in the reasoning chain
 *
 * INVARIANT: All metrics are computed from immutable trace records.
 * INVARIANT: detectAnomalies() never mutates the input trace.
 */

// ─── Trace Record Types ───────────────────────────────────────────────────────

/**
 * A single event in an agent reasoning trace.
 */
export interface TraceRecord {
  /** Step identifier (monotonically increasing) */
  stepId: number;
  /** ISO-8601 UTC timestamp */
  timestamp: string;
  /** Type of step */
  kind: 'reasoning' | 'tool_call' | 'tool_result' | 'decision' | 'llm_output';
  /** Tool name (for tool_call / tool_result steps) */
  toolName?: string;
  /** Tool input hash or short representation (for ping-pong detection) */
  toolInputHash?: string;
  /** Number of reasoning/thinking tokens (for reasoning steps) */
  reasoningTokens?: number;
  /** Total output tokens (for llm_output steps) */
  outputTokens?: number;
  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
}

// ─── Computed Metrics ─────────────────────────────────────────────────────────

/**
 * Metrics computed from a full TraceRecord array.
 */
export interface TraceMetrics {
  /** Reasoning Overhead: reasoning tokens per tool call (target < 200) */
  reasoningOverhead: number;
  /** Tool Ping-Pong ratio: repeated tool calls / total tool calls (target < 0.05) */
  toolPingPong: number;
  /** Milliseconds from first record to first tool_call record */
  decisionLatencyMs: number;
  /** Total number of steps in the chain */
  totalChainLength: number;
  /** Total reasoning tokens across all steps */
  totalReasoningTokens: number;
  /** Total tool call count */
  totalToolCalls: number;
  /** Total distinct tool names used */
  distinctToolNames: number;
}

// ─── Anomaly Result ───────────────────────────────────────────────────────────

/**
 * A detected trace-level anomaly.
 */
export interface TraceAnomaly {
  /** Anomaly type */
  kind: 'high_reasoning_overhead' | 'tool_ping_pong' | 'high_decision_latency' | 'long_chain';
  /** Human-readable description */
  description: string;
  /** Observed value */
  observed: number;
  /** Threshold that was breached */
  threshold: number;
  severity: 'warning' | 'critical';
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

export interface TraceAnomalyThresholds {
  /** Reasoning Overhead: alert if > N tokens/action (default: 200) */
  maxReasoningOverhead: number;
  /** Tool Ping-Pong ratio: alert if > N (default: 0.05) */
  maxToolPingPong: number;
  /** Decision latency: alert if > N ms (default: 5000) */
  maxDecisionLatencyMs: number;
  /** Total chain length: alert if > N steps (default: 50) */
  maxChainLength: number;
  /** Number of times same tool must be called to count as ping-pong (default: 3) */
  pingPongRepeatThreshold: number;
}

const DEFAULT_THRESHOLDS: TraceAnomalyThresholds = {
  maxReasoningOverhead: parseInt(process.env['TRACE_MAX_REASONING_OVERHEAD'] ?? '200', 10),
  maxToolPingPong: parseFloat(process.env['TRACE_MAX_TOOL_PING_PONG'] ?? '0.05'),
  maxDecisionLatencyMs: parseInt(process.env['TRACE_MAX_DECISION_LATENCY_MS'] ?? '5000', 10),
  maxChainLength: parseInt(process.env['TRACE_MAX_CHAIN_LENGTH'] ?? '50', 10),
  pingPongRepeatThreshold: parseInt(process.env['TRACE_PING_PONG_REPEAT_THRESHOLD'] ?? '3', 10),
};

// ─── TraceAnalytics ───────────────────────────────────────────────────────────

/**
 * TraceAnalytics computes efficiency metrics and detects anomalies in agent
 * reasoning traces.  Instantiate once per analysis session or use the module-
 * level helpers for one-shot computation.
 */
export class TraceAnalytics {
  private thresholds: TraceAnomalyThresholds;

  constructor(thresholds: Partial<TraceAnomalyThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * Compute all trace metrics from a list of trace records.
   * @param trace - Ordered list of TraceRecord events
   */
  computeMetrics(trace: TraceRecord[]): TraceMetrics {
    if (trace.length === 0) {
      return {
        reasoningOverhead: 0,
        toolPingPong: 0,
        decisionLatencyMs: 0,
        totalChainLength: 0,
        totalReasoningTokens: 0,
        totalToolCalls: 0,
        distinctToolNames: 0,
      };
    }

    // Aggregate values
    let totalReasoningTokens = 0;
    let totalToolCalls = 0;
    const toolNameCounts = new Map<string, number>();
    const toolCallsByName = new Map<string, number>();
    let firstTimestampMs = 0;
    let firstToolCallMs = 0;

    for (const record of trace) {
      const ts = new Date(record.timestamp).getTime();
      if (firstTimestampMs === 0) firstTimestampMs = ts;

      if (record.kind === 'reasoning' && record.reasoningTokens !== undefined) {
        totalReasoningTokens += record.reasoningTokens;
      }

      if (record.kind === 'tool_call' && record.toolName) {
        if (firstToolCallMs === 0) firstToolCallMs = ts;
        totalToolCalls++;
        toolNameCounts.set(record.toolName, (toolNameCounts.get(record.toolName) ?? 0) + 1);
        toolCallsByName.set(record.toolName, (toolCallsByName.get(record.toolName) ?? 0) + 1);
      }
    }

    // Reasoning Overhead: reasoning tokens / tool calls
    const reasoningOverhead = totalToolCalls > 0
      ? totalReasoningTokens / totalToolCalls
      : totalReasoningTokens;

    // Tool Ping-Pong: tool calls with > N repetitions / total tool calls
    let repeatedCalls = 0;
    for (const count of toolCallsByName.values()) {
      if (count >= this.thresholds.pingPongRepeatThreshold) {
        repeatedCalls += count;
      }
    }
    const toolPingPong = totalToolCalls > 0 ? repeatedCalls / totalToolCalls : 0;

    // Decision Latency: time from first record to first tool call
    const decisionLatencyMs = firstToolCallMs > 0
      ? firstToolCallMs - firstTimestampMs
      : 0;

    return {
      reasoningOverhead,
      toolPingPong,
      decisionLatencyMs,
      totalChainLength: trace.length,
      totalReasoningTokens,
      totalToolCalls,
      distinctToolNames: toolNameCounts.size,
    };
  }

  /**
   * Detect anomalies in computed trace metrics.
   * @param metrics - Metrics computed by computeMetrics()
   */
  detectAnomalies(metrics: TraceMetrics): TraceAnomaly[] {
    const anomalies: TraceAnomaly[] = [];
    const t = this.thresholds;

    if (metrics.reasoningOverhead > t.maxReasoningOverhead) {
      anomalies.push({
        kind: 'high_reasoning_overhead',
        description: `Reasoning overhead ${metrics.reasoningOverhead.toFixed(1)} tokens/action exceeds target ${t.maxReasoningOverhead}`,
        observed: metrics.reasoningOverhead,
        threshold: t.maxReasoningOverhead,
        severity: metrics.reasoningOverhead > t.maxReasoningOverhead * 2 ? 'critical' : 'warning',
      });
    }

    if (metrics.toolPingPong > t.maxToolPingPong) {
      anomalies.push({
        kind: 'tool_ping_pong',
        description: `Tool ping-pong ratio ${(metrics.toolPingPong * 100).toFixed(1)}% exceeds target ${(t.maxToolPingPong * 100).toFixed(1)}%`,
        observed: metrics.toolPingPong,
        threshold: t.maxToolPingPong,
        severity: metrics.toolPingPong > t.maxToolPingPong * 4 ? 'critical' : 'warning',
      });
    }

    if (metrics.decisionLatencyMs > t.maxDecisionLatencyMs) {
      anomalies.push({
        kind: 'high_decision_latency',
        description: `Decision latency ${metrics.decisionLatencyMs}ms exceeds threshold ${t.maxDecisionLatencyMs}ms`,
        observed: metrics.decisionLatencyMs,
        threshold: t.maxDecisionLatencyMs,
        severity: metrics.decisionLatencyMs > t.maxDecisionLatencyMs * 3 ? 'critical' : 'warning',
      });
    }

    if (metrics.totalChainLength > t.maxChainLength) {
      anomalies.push({
        kind: 'long_chain',
        description: `Chain length ${metrics.totalChainLength} exceeds threshold ${t.maxChainLength}`,
        observed: metrics.totalChainLength,
        threshold: t.maxChainLength,
        severity: metrics.totalChainLength > t.maxChainLength * 2 ? 'critical' : 'warning',
      });
    }

    return anomalies;
  }

  /**
   * Convenience helper: compute metrics and detect anomalies in one call.
   */
  analyze(trace: TraceRecord[]): { metrics: TraceMetrics; anomalies: TraceAnomaly[] } {
    const metrics = this.computeMetrics(trace);
    const anomalies = this.detectAnomalies(metrics);
    return { metrics, anomalies };
  }
}

// ─── Module-level helpers ─────────────────────────────────────────────────────

const _defaultAnalytics = new TraceAnalytics();

/**
 * Compute trace metrics using default thresholds.
 */
export function computeTraceMetrics(trace: TraceRecord[]): TraceMetrics {
  return _defaultAnalytics.computeMetrics(trace);
}

/**
 * Detect anomalies from pre-computed metrics using default thresholds.
 */
export function detectTraceAnomalies(metrics: TraceMetrics): TraceAnomaly[] {
  return _defaultAnalytics.detectAnomalies(metrics);
}
