/**
 * Hash utilities for deterministic operations
 */

import { createHash } from 'node:crypto';
import { hash as blake3Hash } from 'blake3';

export interface HashBridge {
  artifact_hash: string;
  runtime_hash: string;
  canonical_hash: string;
}

/**
 * Create a deterministic hash of input data
 * Uses BLAKE3 to match the native engine's hashing logic.
 */
export function hash(data: string | Buffer): string {
  const content = typeof data === 'string' ? Buffer.from(data) : data;
  return blake3Hash(content).toString('hex');
}

export function runtimeHash(data: string | Buffer): string {
  const content = typeof data === 'string' ? Buffer.from(data) : data;
  return createHash('sha256').update(content).digest('hex');
}

export function createHashBridge(data: string | Buffer): HashBridge {
  const artifactHash = hash(data);
  return {
    artifact_hash: artifactHash,
    runtime_hash: runtimeHash(data),
    canonical_hash: artifactHash,
  };
}

/**
 * Create a short hash (first 16 characters)
 */
export function hashShort(data: string | Buffer): string {
  return hash(data).substring(0, 16);
}
