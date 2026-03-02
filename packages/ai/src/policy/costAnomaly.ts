/**
 * @fileoverview Cost Anomaly Detection for AI operations.
 *
 * Implements per-tenant anomaly detection metrics per the COST_ANOMALY_STRATEGY.md
 * specification:
 *   - Token Velocity (TV): tokens/min vs rolling average
 *   - Tool Loop Density (TLD): tool calls per decision
 *   - Sequential Fallback Count (SFC): consecutive model fallbacks
 *   - Cost Spike: single request cost vs rolling average
 *
 * INVARIANT: Detection runs on every cost record — not on a schedule.
 * INVARIANT: anomalies are emitted to the audit log, not silently swallowed.
 * INVARIANT: All thresholds are configurable via env vars or constructor config.
 */

import { logger } from '../telemetry/logger.js';

// ─── Public Types ─────────────────────────────────────────────────────────────

/** Severity levels for detected anomalies (maps to COST_ANOMALY_STRATEGY threshold matrix). */
export type AnomalySeverity = 'warning' | 'critical';

/**
 * Result of a single anomaly detector metric check.
 */
export interface AnomalyResult {
  /** Whether an anomaly was detected */
  detected: boolean;
  /** Metric name (e.g. "token_velocity") */
  metric: string;
  /** Observed value */
  value: number;
  /** Configured threshold that was breached (or compared against) */
  threshold: number;
  /** 'warning' for yellow/orange alerts; 'critical' for red/kill alerts */
  severity: AnomalySeverity;
  /** Human-readable explanation */
  reason?: string;
}

/**
 * Input context provided to each anomaly detector on a cost record call.
 */
export interface AnomalyContext {
  tenantId: string;
  requestId?: string;
  /** Cost of this single request in USD cents */
  requestCostCents: number;
  /** Tokens consumed in this request */
  tokens: number;
  /** Number of tool calls made in this request */
  toolCallCount?: number;
  /** Number of consecutive model fallbacks so far */
  consecutiveFallbacks?: number;
  /** Unix timestamp in milliseconds when this record was captured */
  timestampMs?: number;
}

/**
 * Thresholds for CostAnomalyDetector — all are configurable.
 */
export interface AnomalyThresholds {
  /** Token velocity multiplier: alert if current rate > X * rolling average (default 2) */
  tokenVelocityMultiplier: number;
  /** Max tool calls per request before flagging loop density (default 10) */
  toolLoopDensityMax: number;
  /** Max consecutive model fallbacks before alerting (default 3) */
  maxSequentialFallbacks: number;
  /** Cost spike multiplier: alert if single request > X * rolling average (default 5) */
  costSpikeMultiplier: number;
  /** Rolling window size for averages (number of samples, default 20) */
  rollingWindowSize: number;
}

const DEFAULT_THRESHOLDS: AnomalyThresholds = {
  tokenVelocityMultiplier: parseFloat(process.env['ANOMALY_TOKEN_VELOCITY_MULTIPLIER'] ?? '2'),
  toolLoopDensityMax: parseInt(process.env['ANOMALY_TOOL_LOOP_MAX'] ?? '10', 10),
  maxSequentialFallbacks: parseInt(process.env['ANOMALY_MAX_FALLBACKS'] ?? '3', 10),
  costSpikeMultiplier: parseFloat(process.env['ANOMALY_COST_SPIKE_MULTIPLIER'] ?? '5'),
  rollingWindowSize: parseInt(process.env['ANOMALY_ROLLING_WINDOW_SIZE'] ?? '20', 10),
};

// ─── Rolling Window Helper ────────────────────────────────────────────────────

/** Maintains a fixed-size rolling window of numeric samples. */
class RollingWindow {
  private samples: number[] = [];
  constructor(private maxSize: number) {}

  push(value: number): void {
    this.samples.push(value);
    if (this.samples.length > this.maxSize) {
      this.samples.shift();
    }
  }

  average(): number {
    if (this.samples.length === 0) return 0;
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
  }

  size(): number {
    return this.samples.length;
  }
}

// ─── Per-Tenant State ─────────────────────────────────────────────────────────

interface TenantAnomalyState {
  tokenVelocityWindow: RollingWindow;
  costWindow: RollingWindow;
  lastRecordTimestampMs: number;
}

// ─── Cost Anomaly Detector ────────────────────────────────────────────────────

/**
 * CostAnomalyDetector runs four metrics on every cost record call:
 *  1. Token Velocity — tokens/min vs rolling average
 *  2. Tool Loop Density — tool calls per request
 *  3. Sequential Fallback Count — consecutive model fallbacks
 *  4. Cost Spike — request cost vs rolling average
 *
 * Wire it into BudgetChecker.record() so it runs on every recorded spend.
 */
export class CostAnomalyDetector {
  private thresholds: AnomalyThresholds;
  private tenantState = new Map<string, TenantAnomalyState>();

  constructor(thresholds: Partial<AnomalyThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /** Get or create per-tenant state */
  private state(tenantId: string): TenantAnomalyState {
    if (!this.tenantState.has(tenantId)) {
      this.tenantState.set(tenantId, {
        tokenVelocityWindow: new RollingWindow(this.thresholds.rollingWindowSize),
        costWindow: new RollingWindow(this.thresholds.rollingWindowSize),
        lastRecordTimestampMs: 0,
      });
    }
    return this.tenantState.get(tenantId)!;
  }

  /**
   * Run all anomaly checks against the provided context.
   * Returns the list of detected anomalies (may be empty).
   * Logs each detected anomaly to the audit logger.
   */
  check(ctx: AnomalyContext): AnomalyResult[] {
    const results: AnomalyResult[] = [
      this.checkTokenVelocity(ctx),
      this.checkToolLoopDensity(ctx),
      this.checkSequentialFallbacks(ctx),
      this.checkCostSpike(ctx),
    ];

    const detected = results.filter(r => r.detected);
    for (const anomaly of detected) {
      logger.warn('[costAnomaly] Anomaly detected', {
        tenantId: ctx.tenantId,
        requestId: ctx.requestId,
        metric: anomaly.metric,
        value: anomaly.value,
        threshold: anomaly.threshold,
        severity: anomaly.severity,
        reason: anomaly.reason,
      });
    }

    // Update rolling windows after checks (so current sample doesn't influence its own check)
    const s = this.state(ctx.tenantId);
    const now = ctx.timestampMs ?? Date.now();
    const elapsedMinutes = s.lastRecordTimestampMs > 0
      ? Math.max((now - s.lastRecordTimestampMs) / 60_000, 0.001)
      : 1;
    const tokensPerMinute = ctx.tokens / elapsedMinutes;

    s.tokenVelocityWindow.push(tokensPerMinute);
    s.costWindow.push(ctx.requestCostCents);
    s.lastRecordTimestampMs = now;

    return detected;
  }

  /** Check Token Velocity: current tokens/min vs 2× rolling average */
  private checkTokenVelocity(ctx: AnomalyContext): AnomalyResult {
    const s = this.state(ctx.tenantId);
    const now = ctx.timestampMs ?? Date.now();
    const elapsedMinutes = s.lastRecordTimestampMs > 0
      ? Math.max((now - s.lastRecordTimestampMs) / 60_000, 0.001)
      : 1;

    const currentRate = ctx.tokens / elapsedMinutes;
    const avg = s.tokenVelocityWindow.average();

    // Need at least a few samples before comparing
    if (s.tokenVelocityWindow.size() < 3 || avg === 0) {
      return { detected: false, metric: 'token_velocity', value: currentRate, threshold: 0, severity: 'warning' };
    }

    const threshold = avg * this.thresholds.tokenVelocityMultiplier;
    const detected = currentRate > threshold;

    return {
      detected,
      metric: 'token_velocity',
      value: currentRate,
      threshold,
      severity: detected && currentRate > threshold * 2 ? 'critical' : 'warning',
      reason: detected
        ? `Token rate ${currentRate.toFixed(1)}/min exceeds ${this.thresholds.tokenVelocityMultiplier}× average (${avg.toFixed(1)}/min)`
        : undefined,
    };
  }

  /** Check Tool Loop Density: tool calls per request vs configured max */
  private checkToolLoopDensity(ctx: AnomalyContext): AnomalyResult {
    const toolCalls = ctx.toolCallCount ?? 0;
    const threshold = this.thresholds.toolLoopDensityMax;
    const detected = toolCalls > threshold;

    return {
      detected,
      metric: 'tool_loop_density',
      value: toolCalls,
      threshold,
      severity: toolCalls > threshold * 2 ? 'critical' : 'warning',
      reason: detected
        ? `Tool call count ${toolCalls} exceeds loop density threshold ${threshold}`
        : undefined,
    };
  }

  /** Check Sequential Fallback Count: consecutive model fallbacks */
  private checkSequentialFallbacks(ctx: AnomalyContext): AnomalyResult {
    const fallbacks = ctx.consecutiveFallbacks ?? 0;
    const threshold = this.thresholds.maxSequentialFallbacks;
    const detected = fallbacks > threshold;

    return {
      detected,
      metric: 'sequential_fallback_count',
      value: fallbacks,
      threshold,
      severity: fallbacks > threshold * 2 ? 'critical' : 'warning',
      reason: detected
        ? `${fallbacks} consecutive model fallbacks exceeds threshold ${threshold}`
        : undefined,
    };
  }

  /** Check Cost Spike: request cost vs 5× rolling average */
  private checkCostSpike(ctx: AnomalyContext): AnomalyResult {
    const s = this.state(ctx.tenantId);
    const avg = s.costWindow.average();

    if (s.costWindow.size() < 3 || avg === 0) {
      return { detected: false, metric: 'cost_spike', value: ctx.requestCostCents, threshold: 0, severity: 'warning' };
    }

    const threshold = avg * this.thresholds.costSpikeMultiplier;
    const detected = ctx.requestCostCents > threshold;

    return {
      detected,
      metric: 'cost_spike',
      value: ctx.requestCostCents,
      threshold,
      severity: ctx.requestCostCents > threshold * 2 ? 'critical' : 'warning',
      reason: detected
        ? `Request cost ${ctx.requestCostCents}¢ is ${(ctx.requestCostCents / avg).toFixed(1)}× average (${avg.toFixed(1)}¢)`
        : undefined,
    };
  }

  /** Reset state for a tenant (for testing). */
  _reset(tenantId?: string): void {
    if (tenantId) {
      this.tenantState.delete(tenantId);
    } else {
      this.tenantState.clear();
    }
  }
}

// ─── Global Detector ──────────────────────────────────────────────────────────

let _anomalyDetector: CostAnomalyDetector = new CostAnomalyDetector();

/** Replace the global anomaly detector (useful for test injection). */
export function setAnomalyDetector(detector: CostAnomalyDetector): void {
  _anomalyDetector = detector;
}

/** Get the global anomaly detector instance. */
export function getAnomalyDetector(): CostAnomalyDetector {
  return _anomalyDetector;
}
