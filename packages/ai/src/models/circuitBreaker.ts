/**
 * @fileoverview Circuit breaker for model provider resilience.
 *
 * Tracks consecutive failures per model and opens the circuit
 * when a threshold is exceeded, preventing cascading failures.
 *
 * States: CLOSED (normal) → OPEN (failing fast) → HALF_OPEN (probe) → CLOSED
 */

import { AiError } from '../errors/AiError';
import { AiErrorCode } from '../errors/codes';
import { logger } from '../telemetry/logger';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening circuit */
  failureThreshold: number;
  /** Milliseconds to wait before moving to HALF_OPEN */
  recoveryTimeMs: number;
  /** Number of successful probes to close the circuit again */
  successThreshold: number;
  /**
   * Maximum recursion depth per request context before tripping the breaker.
   * Default: 10.  Set to 0 to disable recursion depth checking.
   */
  maxRecursionDepth?: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeMs: 30_000,
  successThreshold: 2,
  maxRecursionDepth: parseInt(process.env['CIRCUIT_MAX_RECURSION_DEPTH'] ?? '10', 10),
};

// ─── Recursion Depth Tracking ─────────────────────────────────────────────────

/**
 * Per-request recursion depth counter.  Key is the requestId / traceId.
 * INVARIANT: Depth must be released (decremented) in a finally block to avoid leaks.
 */
const _recursionDepths = new Map<string, number>();

/**
 * Increment the recursion depth for a request context and check against the limit.
 * Throws `RecursionDepthExceeded` (AiErrorCode.RECURSION_DEPTH_EXCEEDED) if the
 * limit is reached.
 *
 * @param contextKey - Unique key for the request context (traceId / requestId)
 * @param config - Circuit breaker config (uses maxRecursionDepth)
 * @returns The new depth value (for observability)
 */
export function enterRecursion(
  contextKey: string,
  config: CircuitBreakerConfig = DEFAULT_CONFIG
): number {
  const limit = config.maxRecursionDepth ?? DEFAULT_CONFIG.maxRecursionDepth ?? 10;
  const current = (_recursionDepths.get(contextKey) ?? 0) + 1;
  _recursionDepths.set(contextKey, current);

  if (limit > 0 && current > limit) {
    logger.warn('[circuit] Recursion depth exceeded', { contextKey, depth: current, limit });
    // Trip the circuit for this context key
    recordFailure(contextKey, `RecursionDepthExceeded at depth ${current}`, config);
    throw new AiError({
      code: AiErrorCode.RECURSION_DEPTH_EXCEEDED,
      message: `Recursion depth ${current} exceeds limit ${limit} for context ${contextKey}`,
      phase: 'circuit.recursion',
    });
  }

  return current;
}

/**
 * Decrement the recursion depth for a request context.
 * MUST be called in a `finally` block matching every `enterRecursion()` call.
 *
 * @param contextKey - Unique key for the request context
 */
export function exitRecursion(contextKey: string): void {
  const current = _recursionDepths.get(contextKey) ?? 0;
  if (current <= 1) {
    _recursionDepths.delete(contextKey);
  } else {
    _recursionDepths.set(contextKey, current - 1);
  }
}

/**
 * Get the current recursion depth for a request context.
 * Returns 0 if not tracked.
 */
export function getRecursionDepth(contextKey: string): number {
  return _recursionDepths.get(contextKey) ?? 0;
}

/**
 * Reset recursion tracking for a context key (for test teardown).
 */
export function resetRecursionDepth(contextKey: string): void {
  _recursionDepths.delete(contextKey);
}

interface CircuitData {
  state: CircuitState;
  failures: number;
  successes: number;
  openedAt?: number;
  lastFailure?: string;
}

const _circuits = new Map<string, CircuitData>();

function getCircuit(key: string): CircuitData {
  if (!_circuits.has(key)) {
    _circuits.set(key, { state: 'CLOSED', failures: 0, successes: 0 });
  }
  return _circuits.get(key)!;
}

/**
 * Check if a model circuit allows a call.
 * Throws AiError.CIRCUIT_OPEN if the circuit is open.
 */
export function checkCircuit(modelKey: string, config: CircuitBreakerConfig = DEFAULT_CONFIG): void {
  const circuit = getCircuit(modelKey);

  if (circuit.state === 'OPEN') {
    const elapsed = Date.now() - (circuit.openedAt ?? 0);
    if (elapsed >= config.recoveryTimeMs) {
      circuit.state = 'HALF_OPEN';
      circuit.successes = 0;
      logger.info(`[circuit] ${modelKey}: OPEN → HALF_OPEN (recovery probe)`);
    } else {
      throw AiError.circuitOpen(modelKey);
    }
  }
}

/**
 * Record a successful call — may close a HALF_OPEN circuit.
 */
export function recordSuccess(modelKey: string, config: CircuitBreakerConfig = DEFAULT_CONFIG): void {
  const circuit = getCircuit(modelKey);

  if (circuit.state === 'HALF_OPEN') {
    circuit.successes++;
    if (circuit.successes >= config.successThreshold) {
      circuit.state = 'CLOSED';
      circuit.failures = 0;
      circuit.successes = 0;
      logger.info(`[circuit] ${modelKey}: HALF_OPEN → CLOSED`);
    }
  } else if (circuit.state === 'CLOSED') {
    // Reset failure count on success
    circuit.failures = 0;
  }
}

/**
 * Record a failed call — may open the circuit.
 */
export function recordFailure(modelKey: string, error: string, config: CircuitBreakerConfig = DEFAULT_CONFIG): void {
  const circuit = getCircuit(modelKey);
  circuit.failures++;
  circuit.lastFailure = error;

  if (circuit.state === 'CLOSED' && circuit.failures >= config.failureThreshold) {
    circuit.state = 'OPEN';
    circuit.openedAt = Date.now();
    logger.warn(`[circuit] ${modelKey}: CLOSED → OPEN (${circuit.failures} failures)`);
  } else if (circuit.state === 'HALF_OPEN') {
    circuit.state = 'OPEN';
    circuit.openedAt = Date.now();
    logger.warn(`[circuit] ${modelKey}: HALF_OPEN → OPEN (probe failed)`);
  }
}

export function getCircuitState(modelKey: string): CircuitState {
  return getCircuit(modelKey).state;
}

export function resetCircuit(modelKey: string): void {
  _circuits.delete(modelKey);
}
