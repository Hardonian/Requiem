/**
 * Database helper functions
 */

import { randomBytes } from 'crypto';

/**
 * Generate a new unique ID with optional prefix
 */
export function newId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(8).toString('hex').substring(0, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generate a UUID v4
 */
export function uuid(): string {
  return randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

