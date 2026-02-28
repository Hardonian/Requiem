/**
 * Deterministic Clock Abstraction
 * 
 * INVARIANT: Core logic uses Clock interface, not direct Date/time.
 * INVARIANT: Seeded clocks produce identical timestamps for replay.
 * INVARIANT: Wall clock only used at system boundaries.
 * 
 * This enables:
 * - Deterministic replay of executions
 * - Testing time-dependent logic without mocking globals
 * - Configurable time granularity for different environments
 */

/**
 * Clock interface for all time-dependent operations.
 */
export interface Clock {
  /**
   * Get current timestamp in milliseconds (Unix epoch).
   */
  now(): number;

  /**
   * Get current timestamp as ISO string.
   */
  nowISO(): string;

  /**
   * Get current timestamp as Date object.
   */
  nowDate(): Date;

  /**
   * Get elapsed time since clock creation or last reset.
   */
  elapsed(): number;

  /**
   * Create a child clock with offset.
   */
  withOffset(offsetMs: number): Clock;

  /**
   * Clock identifier for debugging.
   */
  readonly id: string;
}

/**
 * System clock — uses actual wall time.
 * Used in production and when determinism is not required.
 */
export class SystemClock implements Clock {
  readonly id: string;
  private startTime: number;

  constructor(id = 'system') {
    this.id = id;
    this.startTime = Date.now();
  }

  now(): number {
    return Date.now();
  }

  nowISO(): string {
    return new Date().toISOString();
  }

  nowDate(): Date {
    return new Date();
  }

  elapsed(): number {
    return Date.now() - this.startTime;
  }

  withOffset(offsetMs: number): Clock {
    return new OffsetClock(this, offsetMs, `${this.id}+offset`);
  }
}

/**
 * Seeded clock — produces deterministic timestamps.
 * Used for replay, testing, and reproducible executions.
 */
export class SeededClock implements Clock {
  readonly id: string;
  private seed: number;
  private current: number;
  private increment: number;
  private startTime: number;

  /**
   * @param seed Initial timestamp (ms since epoch)
   * @param incrementMs Amount to advance per call (default: 1ms)
   * @param id Clock identifier
   */
  constructor(seed: number, incrementMs = 1, id = 'seeded') {
    this.id = id;
    this.seed = seed;
    this.current = seed;
    this.increment = incrementMs;
    this.startTime = seed;
  }

  now(): number {
    const value = this.current;
    this.current += this.increment;
    return value;
  }

  nowISO(): string {
    return new Date(this.now()).toISOString();
  }

  nowDate(): Date {
    return new Date(this.now());
  }

  elapsed(): number {
    return this.current - this.startTime;
  }

  withOffset(offsetMs: number): Clock {
    return new SeededClock(this.current + offsetMs, this.increment, `${this.id}+offset`);
  }

  /**
   * Get the seed value (for serialization).
   */
  getSeed(): number {
    return this.seed;
  }

  /**
   * Get the increment value.
   */
  getIncrement(): number {
    return this.increment;
  }
}

/**
 * Frozen clock — always returns the same timestamp.
 * Used for testing and when time must be constant.
 */
export class FrozenClock implements Clock {
  readonly id: string;
  private frozenTime: number;

  constructor(frozenTime: number | Date = 0, id = 'frozen') {
    this.id = id;
    this.frozenTime = typeof frozenTime === 'number' ? frozenTime : frozenTime.getTime();
  }

  now(): number {
    return this.frozenTime;
  }

  nowISO(): string {
    return new Date(this.frozenTime).toISOString();
  }

  nowDate(): Date {
    return new Date(this.frozenTime);
  }

  elapsed(): number {
    return 0;
  }

  withOffset(offsetMs: number): Clock {
    return new FrozenClock(this.frozenTime + offsetMs, `${this.id}+offset`);
  }

  /**
   * Set a new frozen time.
   */
  setTime(time: number | Date): void {
    this.frozenTime = typeof time === 'number' ? time : time.getTime();
  }
}

/**
 * Offset clock — adds offset to parent clock.
 */
export class OffsetClock implements Clock {
  readonly id: string;
  private parent: Clock;
  private offset: number;

  constructor(parent: Clock, offset: number, id: string) {
    this.parent = parent;
    this.offset = offset;
    this.id = id;
  }

  now(): number {
    return this.parent.now() + this.offset;
  }

  nowISO(): string {
    return new Date(this.now()).toISOString();
  }

  nowDate(): Date {
    return new Date(this.now());
  }

  elapsed(): number {
    return this.parent.elapsed();
  }

  withOffset(offsetMs: number): Clock {
    return new OffsetClock(this.parent, this.offset + offsetMs, `${this.id}+offset`);
  }
}

/**
 * Global clock instance.
 * Set at application startup.
 */
let globalClock: Clock = new SystemClock('global');

/**
 * Set the global clock instance.
 */
export function setGlobalClock(clock: Clock): void {
  globalClock = clock;
}

/**
 * Get the global clock instance.
 */
export function getGlobalClock(): Clock {
  return globalClock;
}

/**
 * Convenience functions using global clock.
 */
export const ClockUtil = {
  now: () => globalClock.now(),
  nowISO: () => globalClock.nowISO(),
  nowDate: () => globalClock.nowDate(),
  elapsed: () => globalClock.elapsed(),
};

/**
 * Create a deterministic seed from a string.
 * Used to generate consistent seeds from request IDs.
 */
export function seedFromString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) + 1700000000000; // Start from 2023-11
}

/**
 * Config snapshot that affects behavior.
 * Captured at execution start for replay verification.
 */
export interface ConfigSnapshot {
  /** Version of the config format */
  version: string;
  /** Config values that affect behavior */
  values: Record<string, unknown>;
  /** Timestamp when snapshot was taken */
  capturedAt: string;
  /** Clock seed (if using seeded clock) */
  clockSeed?: number;
  /** Clock increment (if using seeded clock) */
  clockIncrement?: number;
}

/**
 * Capture a config snapshot.
 */
export function captureConfigSnapshot(
  version: string,
  values: Record<string, unknown>,
  clock?: Clock
): ConfigSnapshot {
  const snapshot: ConfigSnapshot = {
    version,
    values: { ...values },
    capturedAt: new Date().toISOString(),
  };

  if (clock instanceof SeededClock) {
    snapshot.clockSeed = clock.getSeed();
    snapshot.clockIncrement = clock.getIncrement();
  }

  return snapshot;
}

/**
 * Compute a hash of config snapshot for integrity verification.
 */
export function hashConfigSnapshot(snapshot: ConfigSnapshot): string {
  const crypto = require('crypto');
  const canonical = JSON.stringify(snapshot, Object.keys(snapshot).sort());
  return crypto.createHash('sha256').update(canonical).digest('hex').substring(0, 32);
}

/**
 * Verify that replay config matches expected snapshot.
 */
export function verifyConfigSnapshot(
  expected: ConfigSnapshot,
  actual: ConfigSnapshot
): { valid: boolean; mismatches: string[] } {
  const mismatches: string[] = [];

  if (expected.version !== actual.version) {
    mismatches.push(`version: expected "${expected.version}", got "${actual.version}"`);
  }

  const expectedKeys = Object.keys(expected.values).sort();
  const actualKeys = Object.keys(actual.values).sort();

  if (JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys)) {
    mismatches.push(`keys mismatch: expected [${expectedKeys.join(', ')}], got [${actualKeys.join(', ')}]`);
  }

  for (const key of expectedKeys) {
    const expectedValue = JSON.stringify(expected.values[key]);
    const actualValue = JSON.stringify(actual.values[key]);
    if (expectedValue !== actualValue) {
      mismatches.push(`${key}: expected ${expectedValue}, got ${actualValue}`);
    }
  }

  return { valid: mismatches.length === 0, mismatches };
}

/**
 * Clock-aware timeout wrapper.
 * Uses clock for deterministic timeouts in tests/replay.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  clock: Clock = globalClock,
  abortSignal?: AbortSignal
): Promise<T> {
  const startTime = clock.now();

  return new Promise((resolve, reject) => {
    const checkTimeout = () => {
      if (clock.now() - startTime >= timeoutMs) {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        return true;
      }
      return false;
    };

    // For system clock, use actual setTimeout
    if (clock instanceof SystemClock) {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeoutId));

      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new Error('Operation aborted'));
        });
      }
    } else {
      // For deterministic clocks, poll (used in tests)
      const pollInterval = setInterval(() => {
        if (checkTimeout()) {
          clearInterval(pollInterval);
        }
      }, 1);

      promise
        .then(resolve)
        .catch(reject)
        .finally(() => clearInterval(pollInterval));
    }
  });
}
