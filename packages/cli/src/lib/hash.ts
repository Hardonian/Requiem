/**
 * Hash utilities for deterministic operations
 */

import { createHash } from 'crypto';

/**
 * Create a deterministic hash of input data
 * Uses SHA-256 for compatibility across platforms
 */
export function hash(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Create a short hash (first 16 characters)
 */
export function hashShort(data: string): string {
  return hash(data).substring(0, 16);
}
