/**
 * @fileoverview Circuit breaker for model provider resilience.
 *
 * Tracks consecutive failures per model and opens the circuit
 * when a threshold is exceeded, preventing cascading failures.
 *
 * States: CLOSED (normal) → OPEN (failing fast) → HALF_OPEN (probe) → CLOSED
 */

import { AiError } from '../errors/AiError.js';
import { logger } from '../telemetry/logger.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening circuit */
  failureThreshold: number;
  /** Milliseconds to wait before moving to HALF_OPEN */
  recoveryTimeMs: number;
  /** Number of successful probes to close the circuit again */
  successThreshold: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeMs: 30_000,
  successThreshold: 2,
};

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
