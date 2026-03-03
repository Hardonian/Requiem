/**
 * Stable hashing utilities for deterministic dataset IDs.
 * Uses SHA-256 over canonical JSON for stable, reproducible hashes.
 */

import { createHash } from 'crypto';
import type { CanonicalValue } from './canonical.js';

/**
 * Compute a stable SHA-256 hash of canonical JSON.
 * This ensures the same data always produces the same hash.
 */
export function stableHash(data: CanonicalValue): string {
  const canonical = JSON.stringify(data);
  return sha256(canonical);
}

/**
 * Compute SHA-256 hash of a string.
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Compute a short hash (first 16 characters) for use as IDs.
 */
export function shortHash(data: CanonicalValue): string {
  return stableHash(data).substring(0, 16);
}

/**
 * Compute dataset ID from dataset code, version, and seed.
 */
export function computeDatasetId(
  datasetCode: string,
  version: number,
  seed: number
): string {
  return shortHash({
    datasetCode,
    version,
    seed,
  });
}

/**
 * Compute a run ID from dataset ID, timestamp, and trace ID.
 */
export function computeRunId(
  datasetId: string,
  timestamp: string,
  traceId: string
): string {
  return shortHash({
    datasetId,
    timestamp,
    traceId,
  });
}
