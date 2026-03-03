export type CanonicalJson = null | boolean | number | string | CanonicalJson[] | { [key: string]: CanonicalJson };

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Non-finite numbers are not supported in canonical JSON');
  if (Object.is(value, -0)) return 0;
  return Number(value.toString());
}

function normalizeString(value: string): string {
  const isoCandidate = new Date(value);
  if (!Number.isNaN(isoCandidate.getTime()) && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return isoCandidate.toISOString();
  }
  return value;
}

export function normalizeCanonical(value: unknown): CanonicalJson {
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return normalizeNumber(value);
  if (typeof value === 'string') return normalizeString(value);
  if (Array.isArray(value)) return value.map(normalizeCanonical);
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, normalizeCanonical(v)] as const);
    return Object.fromEntries(entries);
  }
  throw new Error(`Unsupported canonical JSON value type: ${typeof value}`);
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(normalizeCanonical(value));
}
