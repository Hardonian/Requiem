/**
 * @fileoverview Output diffing for evaluation harness.
 *
 * Compares skill/tool outputs to golden values.
 * Returns structured diffs with path-level granularity.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiffEntry {
  path: string;
  type: 'missing' | 'extra' | 'mismatch' | 'type_change';
  expected?: unknown;
  actual?: unknown;
}

export interface DiffResult {
  isMatch: boolean;
  diffs: DiffEntry[];
}

// ─── Core Diff ────────────────────────────────────────────────────────────────

/**
 * Deep-compare two values, returning structured diffs.
 * Ignores order in arrays only if both sides are simple value arrays.
 */
export function diffValues(expected: unknown, actual: unknown, path = ''): DiffEntry[] {
  const diffs: DiffEntry[] = [];

  if (expected === actual) return diffs;

  const expType = getType(expected);
  const actType = getType(actual);

  if (expType !== actType) {
    diffs.push({ path: path || 'root', type: 'type_change', expected, actual });
    return diffs;
  }

  if (expType === 'object') {
    const expObj = expected as Record<string, unknown>;
    const actObj = actual as Record<string, unknown>;

    for (const key of Object.keys(expObj)) {
      const childPath = path ? `${path}.${key}` : key;
      if (!(key in actObj)) {
        diffs.push({ path: childPath, type: 'missing', expected: expObj[key] });
      } else {
        diffs.push(...diffValues(expObj[key], actObj[key], childPath));
      }
    }

    for (const key of Object.keys(actObj)) {
      if (!(key in expObj)) {
        const childPath = path ? `${path}.${key}` : key;
        diffs.push({ path: childPath, type: 'extra', actual: actObj[key] });
      }
    }
    return diffs;
  }

  if (expType === 'array') {
    const expArr = expected as unknown[];
    const actArr = actual as unknown[];

    if (expArr.length !== actArr.length) {
      diffs.push({
        path: path ? `${path}.length` : 'length',
        type: 'mismatch',
        expected: expArr.length,
        actual: actArr.length,
      });
    }

    const len = Math.min(expArr.length, actArr.length);
    for (let i = 0; i < len; i++) {
      diffs.push(...diffValues(expArr[i], actArr[i], `${path}[${i}]`));
    }
    return diffs;
  }

  // Primitives
  if (expected !== actual) {
    diffs.push({ path: path || 'root', type: 'mismatch', expected, actual });
  }

  return diffs;
}

export function diff(expected: unknown, actual: unknown): DiffResult {
  const diffs = diffValues(expected, actual);
  return { isMatch: diffs.length === 0, diffs };
}

function getType(value: unknown): 'null' | 'array' | 'object' | 'string' | 'number' | 'boolean' | 'undefined' {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value as 'string' | 'number' | 'boolean' | 'undefined' | 'object';
}
