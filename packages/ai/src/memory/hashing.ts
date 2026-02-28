/**
 * @fileoverview Content hashing for the memory bridge.
 *
 * Uses SHA-256 for content-addressable storage.
 * INVARIANT: Same content always produces same hash (deterministic).
 * INVARIANT: Hashing uses normalized content (whitespace-trimmed).
 */

import { createHash } from 'crypto';

/**
 * Compute SHA-256 hash of content, returning hex string.
 * Content is normalized (sorted keys for objects) before hashing.
 */
export function hashContent(content: unknown): string {
  const normalized = normalizeForHashing(content);
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Normalize content for deterministic hashing.
 * Objects: keys sorted alphabetically.
 * Strings: trimmed.
 * Arrays: individual elements normalized.
 */
export function normalizeForHashing(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value.map(v => JSON.parse(normalizeForHashing(v))));
  }
  if (typeof value === 'object' && value !== null) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      sorted[key] = (value as Record<string, unknown>)[key];
    }
    return JSON.stringify(sorted, (_k, v) => {
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        return Object.fromEntries(
          Object.entries(v as object).sort(([a], [b]) => a.localeCompare(b))
        );
      }
      return v;
    });
  }
  return String(value);
}

/**
 * Verify that content matches an expected hash.
 */
export function verifyHash(content: unknown, expectedHash: string): boolean {
  return hashContent(content) === expectedHash;
}
