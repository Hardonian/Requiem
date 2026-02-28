/**
 * @fileoverview Replay divergence detection for the AI control-plane.
 *
 * Detects when actual execution outputs differ from cached replay outputs.
 * This is critical for deterministic tooling - any divergence indicates
 * environmental drift, bugs, or non-deterministic tool behavior.
 *
 * INVARIANT: Deterministic tools MUST produce identical outputs for same inputs.
 * INVARIANT: Any divergence in deterministic tools is logged as a critical error.
 * INVARIANT: Non-deterministic tools are excluded from divergence checks.
 *
 * This TypeScript implementation complements the C++ drift detection in:
 *   - include/requiem/replay.hpp
 *   - formal/verify_policies.sh
 */

import { logger } from '../telemetry/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Result of a divergence check.
 */
export interface DivergenceCheckResult {
  /** Whether outputs diverged */
  diverged: boolean;
  /** Details of the divergence */
  details?: {
    /** Expected output (from replay cache) */
    expected: unknown;
    /** Actual output (from current execution) */
    actual: unknown;
    /** JSON diff between expected and actual */
    diff?: Record<string, { expected: unknown; actual: unknown }>;
    /** Severity of divergence */
    severity: 'warning' | 'critical';
  };
}

/**
 * Configuration for divergence detection.
 */
export interface DivergenceConfig {
  /** If true, any difference is critical; if false, allow minor differences */
  strict: boolean;
  /** Fields to ignore in comparison (e.g., timestamps) */
  ignoreFields?: string[];
  /** Custom comparison function for specific types */
  customComparators?: Record<string, (a: unknown, b: unknown) => boolean>;
}

// Default configuration
const DEFAULT_CONFIG: DivergenceConfig = {
  strict: true,
  ignoreFields: ['timestamp', 'createdAt', 'updatedAt', 'executionTime'],
};

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Check if actual output diverges from expected output in replay cache.
 * 
 * @param expected - The cached output from replay
 * @param actual - The actual output from current execution
 * @param toolName - Name of tool (for logging)
 * @param config - Optional configuration
 */
export function checkReplayDivergence(
  expected: unknown,
  actual: unknown,
  toolName: string,
  config: DivergenceConfig = DEFAULT_CONFIG
): DivergenceCheckResult {
  // Fast path: exact equality
  if (expected === actual) {
    return { diverged: false };
  }

  // Both are null/undefined
  if (expected === null && actual === null) return { diverged: false };
  if (expected === undefined && actual === undefined) return { diverged: false };

  // Type mismatch is always a divergence
  if (typeof expected !== typeof actual) {
    return {
      diverged: true,
      details: {
        expected,
        actual,
        severity: 'critical',
      },
    };
  }

  // For objects, do deep comparison
  if (typeof expected === 'object' && typeof actual === 'object') {
    const diff = compareObjects(
      expected as Record<string, unknown>,
      actual as Record<string, unknown>,
      '',
      config
    );

    if (Object.keys(diff).length === 0) {
      return { diverged: false };
    }

    const severity = config.strict ? 'critical' : 'warning';

    logger.warn('[replay] Divergence detected in deterministic tool', {
      toolName,
      diffCount: Object.keys(diff).length,
      strict: config.strict,
    });

    return {
      diverged: true,
      details: {
        expected,
        actual,
        diff,
        severity,
      },
    };
  }

  // Arrays
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      return {
        diverged: true,
        details: {
          expected: `Array[${expected.length}]`,
          actual: `Array[${actual.length}]`,
          severity: 'critical',
        },
      };
    }

    // Check each element
    const diff: Record<string, { expected: unknown; actual: unknown }> = {};
    for (let i = 0; i < expected.length; i++) {
      if (expected[i] !== actual[i]) {
        diff[`[${i}]`] = { expected: expected[i], actual: actual[i] };
      }
    }

    if (Object.keys(diff).length > 0) {
      return {
        diverged: true,
        details: {
          expected,
          actual,
          diff,
          severity: 'critical',
        },
      };
    }

    return { diverged: false };
  }

  // Primitive comparison
  return {
    diverged: true,
    details: {
      expected,
      actual,
      severity: 'critical',
    },
  };
}

/**
 * Deep comparison of two objects, returning differences.
 */
function compareObjects(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
  path: string,
  config: DivergenceConfig
): Record<string, { expected: unknown; actual: unknown }> {
  const diff: Record<string, { expected: unknown; actual: unknown }> = {};

  const expectedKeys = new Set(Object.keys(expected));
  const actualKeys = new Set(Object.keys(actual));

  // Check for missing keys in actual
  for (const key of expectedKeys) {
    if (config.ignoreFields?.includes(key)) continue;
    if (!actualKeys.has(key)) {
      const fullPath = path ? `${path}.${key}` : key;
      diff[fullPath] = { expected: expected[key], actual: undefined };
    }
  }

  // Check for extra keys in actual
  for (const key of actualKeys) {
    if (config.ignoreFields?.includes(key)) continue;
    if (!expectedKeys.has(key)) {
      const fullPath = path ? `${path}.${key}` : key;
      diff[fullPath] = { expected: undefined, actual: actual[key] };
    }
  }

  // Check common keys
  for (const key of expectedKeys) {
    if (!actualKeys.has(key)) continue;
    if (config.ignoreFields?.includes(key)) continue;

    const expectedVal = expected[key];
    const actualVal = actual[key];
    const fullPath = path ? `${path}.${key}` : key;

    // Recurse for objects
    if (
      typeof expectedVal === 'object' &&
      typeof actualVal === 'object' &&
      expectedVal !== null &&
      actualVal !== null &&
      !Array.isArray(expectedVal) &&
      !Array.isArray(actualVal)
    ) {
      const nestedDiff = compareObjects(
        expectedVal as Record<string, unknown>,
        actualVal as Record<string, unknown>,
        fullPath,
        config
      );
      Object.assign(diff, nestedDiff);
    } else if (expectedVal !== actualVal) {
      // Check custom comparator if provided
      if (config.customComparators?.[key]) {
        if (!config.customComparators[key](expectedVal, actualVal)) {
          diff[fullPath] = { expected: expectedVal, actual: actualVal };
        }
      } else {
        diff[fullPath] = { expected: expectedVal, actual: actualVal };
      }
    }
  }

  return diff;
}

/**
 * Re-export types for consumers
 */
export type { ReplayRecord } from './replay';
