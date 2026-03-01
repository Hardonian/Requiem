/**
 * @fileoverview Circuit breaker for model provider resilience.
 *
 * Tracks consecutive failures per model and opens the circuit
 * when a threshold is exceeded, preventing cascading failures.
 *
 * States: CLOSED (normal) → OPEN (failing fast) → HALF_OPEN (probe) → CLOSED
 *
 * Supports persistent storage via CircuitBreakerPersistence interface.
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
  /** Persistence store type: 'memory' | 'http' | 'file' */
  circuitStateStore?: 'memory' | 'http' | 'file';
}

// ─── Persistence Interface ─────────────────────────────────────────────────────

/**
 * Summary of circuit state for listing operations.
 */
export interface CircuitStateSummary {
  key: string;
  state: CircuitState;
  failures: number;
  successes: number;
  openedAt?: number;
  lastFailure?: string;
}

/**
 * Persistent storage interface for circuit breaker state.
 * Allows circuit state to survive process restarts in production.
 */
export interface CircuitBreakerPersistence {
  /**
   * Save circuit state for a given key.
   * @param key - Unique identifier for the circuit (e.g., model name)
   * @param state - The circuit state to persist
   */
  saveState(key: string, state: CircuitData): Promise<void>;

  /**
   * Load circuit state for a given key.
   * @param key - Unique identifier for the circuit
   * @returns The circuit state or null if not found
   */
  loadState(key: string): Promise<CircuitData | null>;

  /**
   * List all circuit states.
   * @returns Array of circuit state summaries
   */
  listStates(): Promise<CircuitStateSummary[]>;

  /**
   * Delete circuit state for a given key.
   * @param key - Unique identifier for the circuit
   */
  deleteState(key: string): Promise<void>;
}

/**
 * Configuration for HTTP-based circuit state store.
 */
export interface HttpCircuitBreakerStoreConfig {
  /** HTTP endpoint for circuit state API */
  endpoint: string;
  /** Number of retry attempts on failure */
  maxRetries?: number;
  /** Initial backoff in ms */
  initialBackoffMs?: number;
}

/**
 * HTTP-based circuit state store for production.
 * Persists circuit state to a remote HTTP endpoint.
 */
export class HttpCircuitBreakerStore implements CircuitBreakerPersistence {
  private readonly endpoint: string;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private cache: Map<string, CircuitData> = new Map();

  constructor(config: HttpCircuitBreakerStoreConfig) {
    this.endpoint = config.endpoint;
    this.maxRetries = config.maxRetries ?? 3;
    this.initialBackoffMs = config.initialBackoffMs ?? 250;
  }

  async saveState(key: string, state: CircuitData): Promise<void> {
    this.cache.set(key, state);
    await this.#persist(key, state);
  }

  async loadState(key: string): Promise<CircuitData | null> {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    
    // Try to load from remote
    try {
      const response = await fetch(`${this.endpoint}/${encodeURIComponent(key)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json() as CircuitData;
        this.cache.set(key, data);
        return data;
      }
      
      if (response.status === 404) {
        return null;
      }
      
      logger.warn('[circuit:http] Failed to load state', { key, status: response.status });
      return null;
    } catch (err) {
      logger.warn('[circuit:http] Error loading state', { key, error: String(err) });
      return null;
    }
  }

  async listStates(): Promise<CircuitStateSummary[]> {
    // For HTTP store, we maintain a local index
    return Array.from(this.cache.entries()).map(([key, state]) => ({
      key,
      state: state.state,
      failures: state.failures,
      successes: state.successes,
      openedAt: state.openedAt,
      lastFailure: state.lastFailure,
    }));
  }

  async deleteState(key: string): Promise<void> {
    this.cache.delete(key);
    
    try {
      await fetch(`${this.endpoint}/${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      logger.warn('[circuit:http] Error deleting state', { key, error: String(err) });
    }
  }

  private async #persist(key: string, state: CircuitData): Promise<void> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.endpoint}/${encodeURIComponent(key)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state),
        });
        
        if (response.ok) {
          return;
        }
        
        logger.warn('[circuit:http] Failed to persist state', { key, status: response.status });
      } catch (err) {
        lastError = err as Error;
        logger.warn('[circuit:http] Error persisting state', { key, attempt, error: String(err) });
      }
      
      // Exponential backoff
      if (attempt < this.maxRetries - 1) {
        await new Promise(resolve => 
          setTimeout(resolve, this.initialBackoffMs * Math.pow(2, attempt))
        );
      }
    }
    
    logger.error('[circuit:http] Failed to persist state after retries', { 
      key, 
      error: lastError?.message 
    });
  }
}

/**
 * File-based circuit state store for development/testing.
 * Persists circuit state to local JSON files.
 */
export class FileCircuitBreakerStore implements CircuitBreakerPersistence {
  private readonly dir: string;
  private cache: Map<string, CircuitData> = new Map();
  private initialized = false;

  constructor(dir?: string) {
    this.dir = dir ?? '.data/circuit-state';
  }

  private async #ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const { mkdirSync, existsSync, readFileSync, readdirSync } = await import('fs');
      
      if (!existsSync(this.dir)) {
        mkdirSync(this.dir, { recursive: true });
      } else {
        // Load existing states into cache
        const files = readdirSync(this.dir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          try {
            const content = readFileSync(`${this.dir}/${file}`, 'utf-8');
            const data = JSON.parse(content) as CircuitData;
            const key = file.replace('.json', '');
            this.cache.set(key, data);
          } catch {
            // Ignore corrupt files
          }
        }
      }
      
      this.initialized = true;
    } catch (err) {
      logger.warn('[circuit:file] Failed to initialize', { error: String(err) });
      this.initialized = true;
    }
  }

  async saveState(key: string, state: CircuitData): Promise<void> {
    await this.#ensureInitialized();
    this.cache.set(key, state);
    
    try {
      const { writeFileSync, existsSync, mkdirSync } = await import('fs');
      
      if (!existsSync(this.dir)) {
        mkdirSync(this.dir, { recursive: true });
      }
      
      const filePath = `${this.dir}/${key}.json`;
      writeFileSync(filePath, JSON.stringify(state, null, 2));
    } catch (err) {
      logger.warn('[circuit:file] Failed to save state', { key, error: String(err) });
    }
  }

  async loadState(key: string): Promise<CircuitData | null> {
    await this.#ensureInitialized();
    
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    
    try {
      const { existsSync, readFileSync } = await import('fs');
      const filePath = `${this.dir}/${key}.json`;
      
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content) as CircuitData;
        this.cache.set(key, data);
        return data;
      }
      
      return null;
    } catch (err) {
      logger.warn('[circuit:file] Failed to load state', { key, error: String(err) });
      return null;
    }
  }

  async listStates(): Promise<CircuitStateSummary[]> {
    await this.#ensureInitialized();
    
    return Array.from(this.cache.entries()).map(([key, state]) => ({
      key,
      state: state.state,
      failures: state.failures,
      successes: state.successes,
      openedAt: state.openedAt,
      lastFailure: state.lastFailure,
    }));
  }

  async deleteState(key: string): Promise<void> {
    await this.#ensureInitialized();
    this.cache.delete(key);
    
    try {
      const { unlinkSync, existsSync } = await import('fs');
      const filePath = `${this.dir}/${key}.json`;
      
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch (err) {
      logger.warn('[circuit:file] Failed to delete state', { key, error: String(err) });
    }
  }
}

// ─── Persistence Configuration ─────────────────────────────────────────────────

type CircuitStore = CircuitBreakerPersistence | null;
let _circuitStore: CircuitStore = null;

/**
 * Set the circuit breaker persistence store.
 * @param store - The persistence store to use
 */
export function setCircuitStore(store: CircuitBreakerPersistence | null): void {
  _circuitStore = store;
}

/**
 * Get the current circuit breaker persistence store.
 */
export function getCircuitStore(): CircuitStore {
  return _circuitStore;
}

/**
 * Initialize the circuit store based on configuration.
 * Called automatically when config is provided.
 */
export function initCircuitStore(config?: CircuitBreakerConfig): void {
  const storeType = config?.circuitStateStore ?? 'memory';
  
  if (storeType === 'http') {
    const endpoint = process.env.REQUIEM_CIRCUIT_STATE_ENDPOINT;
    if (endpoint) {
      _circuitStore = new HttpCircuitBreakerStore({ endpoint });
    }
  } else if (storeType === 'file') {
    _circuitStore = new FileCircuitBreakerStore();
  }
  // 'memory' means no persistence (default behavior)
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
