/**
 * Hash utilities for deterministic operations
 */

import { hash as blake3Hash } from 'blake3';

/**
 * Create a deterministic hash of input data
 * Uses BLAKE3 to match the native engine's hashing logic.
 */
export function hash(data: string | Buffer): string {
  const content = typeof data === 'string' ? Buffer.from(data) : data;
  return blake3Hash(content).toString('hex');
}

/**
 * Create a short hash (first 16 characters)
 */
export function hashShort(data: string | Buffer): string {
  return hash(data).substring(0, 16);
}
