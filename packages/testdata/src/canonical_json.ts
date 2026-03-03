import type { CanonicalValue } from './registry.js';

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('Non-finite numbers are not supported in canonical JSON');
  }
  if (Object.is(value, -0)) {
    return 0;
  }
  if (Number.isInteger(value)) {
    return value;
  }
  return Number(value.toPrecision(15));
}

export function canonicalize(value: CanonicalValue): CanonicalValue {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return value;
  }

  if (typeof value === 'number') {
    return normalizeNumber(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }

  const out: Record<string, CanonicalValue> = {};
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  for (const key of keys) {
    out[key] = canonicalize(value[key]);
  }
  return out;
}

export function canonicalJsonStringify(value: CanonicalValue): string {
  return JSON.stringify(canonicalize(value));
}

export function canonicalJsonPretty(value: CanonicalValue): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export function canonicalJsonl(values: CanonicalValue[]): string {
  if (values.length === 0) {
    return '';
  }
  return `${values.map((v) => canonicalJsonStringify(v)).join('\n')}\n`;
}
