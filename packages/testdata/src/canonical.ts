/**
 * Canonical JSON utilities for deterministic serialization.
 * Ensures consistent key ordering, number formatting, and no floating point issues.
 */

/**
 * Values that can be serialized to canonical JSON.
 */
export type CanonicalValue =
  | string
  | number
  | boolean
  | null
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

/**
 * Sort object keys recursively and normalize numbers.
 * This ensures the same data always serializes to the same string.
 */
export function canonicalize(value: CanonicalValue): CanonicalValue {
  if (value === null) {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    // Normalize numbers: no floating point unless required
    // Use integer representation when possible
    if (Number.isInteger(value)) {
      return value;
    }
    // For floats, use fixed precision to avoid precision issues
    return parseFloat(value.toFixed(10));
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const result: { [key: string]: CanonicalValue } = {};
    for (const key of keys) {
      // @ts-expect-error - index access
      result[key] = canonicalize(value[key]);
    }
    return result;
  }

  // Handle undefined and functions - not valid JSON
  return null;
}

/**
 * Serialize a value to canonical JSON string.
 * This is deterministic: same input -> same output.
 */
export function toCanonicalJson(value: CanonicalValue): string {
  return JSON.stringify(canonicalize(value));
}

/**
 * Parse JSON and canonicalize the result.
 * This ensures consistent parsing across different JSON implementations.
 */
export function canonicalParse(json: string): CanonicalValue {
  return canonicalize(JSON.parse(json));
}

/**
 * Compare two values for canonical equality.
 */
export function canonicalEquals(a: CanonicalValue, b: CanonicalValue): boolean {
  return toCanonicalJson(a) === toCanonicalJson(b);
}
