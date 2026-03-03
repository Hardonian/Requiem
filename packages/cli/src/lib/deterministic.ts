/**
 * Deterministic Serialization Utilities
 *
 * Provides stable sorting, seeded randomness, and consistent timestamp
 * normalization for reproducible execution and artifact generation.
 */

import crypto from 'crypto';

// ─── Stable Sorting ────────────────────────────────────────────────────────────

/**
 * Sort an array of objects by a key path in a deterministic way.
 * Uses locale-independent string comparison for strings.
 */
export function stableSort<T>(arr: T[], keyPath?: string): T[] {
  const result = [...arr];
  result.sort((a, b) => {
    const aVal = keyPath ? getValueAtPath(a, keyPath) : a;
    const bVal = keyPath ? getValueAtPath(b, keyPath) : b;
    return compareValues(aVal, bVal);
  });
  return result;
}

/**
 * Sort object keys recursively for deterministic JSON serialization.
 */
export function sortKeys<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortKeys) as unknown as T;
  }

  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  for (const key of keys) {
    sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted as T;
}

/**
 * Deterministic JSON stringify with sorted keys and no extra whitespace.
 */
export function deterministicJson<T>(obj: T): string {
  return JSON.stringify(sortKeys(obj));
}

/**
 * Deterministic JSON stringify with pretty printing (still sorted).
 */
export function deterministicJsonPretty<T>(obj: T, indent: number = 2): string {
  return JSON.stringify(sortKeys(obj), null, indent);
}

// ─── Value Comparison ──────────────────────────────────────────────────────────

function compareValues(a: unknown, b: unknown): number {
  // Handle null/undefined
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
  if (b === null || b === undefined) return 1;

  // Different types - sort by type name
  const typeA = typeof a;
  const typeB = typeof b;
  if (typeA !== typeB) {
    return typeA.localeCompare(typeB, 'en');
  }

  // Same type comparison
  switch (typeA) {
    case 'string':
      return (a as string).localeCompare(b as string, 'en', { numeric: true });
    case 'number':
      return (a as number) - (b as number);
    case 'boolean':
      return (a as boolean) === (b as boolean) ? 0 : a ? 1 : -1;
    case 'bigint':
      return Number((a as bigint) - (b as bigint));
    default:
      return String(a).localeCompare(String(b), 'en');
  }
}

function getValueAtPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// ─── Seeded Randomness ─────────────────────────────────────────────────────────

/**
 * Simple seeded random number generator (Mulberry32).
 * Provides deterministic pseudo-random numbers given a seed.
 */
export function createSeededRandom(seed: string): () => number {
  // Create a 32-bit seed from the string
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state = (state * 31 + seed.charCodeAt(i)) >>> 0;
  }
  if (state === 0) state = 1;

  return function(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Shuffle an array using a seeded random generator.
 * Returns a new array; does not mutate the original.
 */
export function seededShuffle<T>(arr: T[], seed: string): T[] {
  const rng = createSeededRandom(seed);
  const result = [...arr];

  // Fisher-Yates shuffle with seeded RNG
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/**
 * Pick a random element from an array using a seeded random generator.
 */
export function seededPick<T>(arr: T[], seed: string): T | undefined {
  if (arr.length === 0) return undefined;
  const rng = createSeededRandom(seed);
  return arr[Math.floor(rng() * arr.length)];
}

// ─── Timestamp Normalization ───────────────────────────────────────────────────

/**
 * Normalize a timestamp to ISO 8601 format with millisecond precision.
 * Strips timezone info and always returns UTC.
 */
export function normalizeTimestamp(input: Date | string | number): string {
  const date = typeof input === 'string' ? new Date(input) :
               typeof input === 'number' ? new Date(input) :
               input;

  // Return ISO string but ensure millisecond precision
  return date.toISOString();
}

/**
 * Truncate a timestamp to a specific precision for grouping.
 */
export function truncateTimestamp(
  input: Date | string | number,
  precision: 'minute' | 'hour' | 'day' = 'hour'
): string {
  const date = typeof input === 'string' ? new Date(input) :
               typeof input === 'number' ? new Date(input) :
               input;

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  if (precision === 'day') {
    return `${year}-${month}-${day}`;
  }

  const hour = String(date.getUTCHours()).padStart(2, '0');

  if (precision === 'hour') {
    return `${year}-${month}-${day}T${hour}:00:00.000Z`;
  }

  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}:00.000Z`;
}

// ─── Hashing ───────────────────────────────────────────────────────────────────

/**
 * Generate a deterministic hash for content.
 * Uses SHA-256 for compatibility; content is normalized before hashing.
 */
export function hashContent(content: string, algorithm: 'sha256' | 'blake3' = 'sha256'): string {
  const normalized = content.normalize('NFC').trim();

  if (algorithm === 'blake3') {
    // Note: blake3 would require the blake3 package
    // For now, use SHA-256 as fallback
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Generate a short hash (first 16 chars) for display purposes.
 */
export function shortHash(content: string, algorithm?: 'sha256' | 'blake3'): string {
  return hashContent(content, algorithm).substring(0, 16);
}

/**
 * Generate a deterministic ID from multiple components.
 */
export function generateDeterministicId(...components: (string | number | boolean)[]): string {
  const normalized = components.map(c => String(c).normalize('NFC').trim()).join('|');
  return hashContent(normalized);
}

// ─── Object Comparison ─────────────────────────────────────────────────────────

/**
 * Deep equality check with deterministic comparison.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if ((a as unknown[]).length !== (b as unknown[]).length) return false;
    for (let i = 0; i < (a as unknown[]).length; i++) {
      if (!deepEqual((a as unknown[])[i], (b as unknown[])[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a as Record<string, unknown>).sort();
  const keysB = Object.keys(b as Record<string, unknown>).sort();

  if (keysA.length !== keysB.length) return false;
  if (keysA.join(',') !== keysB.join(',')) return false;

  for (const key of keysA) {
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate a diff between two objects for change tracking.
 */
export function objectDiff(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>
): { added: string[]; removed: string[]; changed: string[]; unchanged: string[] } {
  const oldKeys = Object.keys(oldObj);
  const newKeys = Object.keys(newObj);

  const added = newKeys.filter(k => !oldKeys.includes(k));
  const removed = oldKeys.filter(k => !newKeys.includes(k));
  const changed: string[] = [];
  const unchanged: string[] = [];

  for (const key of oldKeys) {
    if (newKeys.includes(key)) {
      if (deepEqual(oldObj[key], newObj[key])) {
        unchanged.push(key);
      } else {
        changed.push(key);
      }
    }
  }

  return { added, removed, changed, unchanged };
}

// ─── Artifact Export ───────────────────────────────────────────────────────────

export interface ArtifactManifest {
  version: string;
  created_at: string;
  run_id: string;
  trace_id: string;
  files: Array<{
    path: string;
    hash: string;
    size: number;
  }>;
  metadata: Record<string, unknown>;
}

/**
 * Create an artifact manifest for a run.
 */
export function createArtifactManifest(
  runId: string,
  traceId: string,
  files: Array<{ path: string; content: string }>,
  metadata?: Record<string, unknown>
): ArtifactManifest {
  const manifest: ArtifactManifest = {
    version: '1.0.0',
    created_at: new Date().toISOString(),
    run_id: runId,
    trace_id: traceId,
    files: files.map(f => ({
      path: f.path,
      hash: hashContent(f.content),
      size: Buffer.byteLength(f.content, 'utf8'),
    })),
    metadata: metadata ?? {},
  };

  return manifest;
}

/**
 * Serialize a manifest to deterministic JSON.
 */
export function serializeManifest(manifest: ArtifactManifest): string {
  return deterministicJsonPretty(manifest);
}
