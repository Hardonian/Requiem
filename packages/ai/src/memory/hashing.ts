/**
 * @fileoverview Content hashing for the memory bridge.
 *
 * Uses SHA-256 for content-addressable storage.
 * Also provides BLAKE3 for tool result digests (faster, collision-resistant).
 *
 * INVARIANT: Same content always produces same hash (deterministic).
 * INVARIANT: Hashing uses normalized content (whitespace-trimmed).
 */

import { createHash } from 'crypto';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Try to load BLAKE3, fall back to SHA-256 if not available
const _blake3 = (() => {
  try {
    return require('blake3');
  } catch {
    return null;
  }
})() as any;

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

// ─── BLAKE3 Hashing ─────────────────────────────────────────────────────────────

/**
 * Tool result structure for digest computation.
 */
export interface ToolResult {
  output: unknown;
  toolName: string;
  toolVersion: string;
  latencyMs: number;
  timestamp: string;
}

/**
 * Check if BLAKE3 is available.
 */
export function isBLAKE3Available(): boolean {
  return _blake3 !== null;
}

/**
 * Compute BLAKE3 hash of content, returning hex string.
 * Falls back to SHA-256 if BLAKE3 is not available.
 */
export function hashContentBLAKE3(content: unknown): string {
  const normalized = normalizeForHashing(content);

  if (_blake3) {
    const b3 = (_blake3 as any).default || _blake3;
    return (b3 as any).hash(normalized).toString('hex');
  }

  // Fallback to SHA-256
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Compute BLAKE3 hash for a tool result.
 * Uses JSON-stringified result content with stable key order.
 *
 * @param result - Tool result to digest
 * @returns BLAKE3 hash hex string
 */
export function computeToolResultDigest(result: ToolResult): string {
  const normalizedResult = {
    output: result.output,
    toolName: result.toolName,
    toolVersion: result.toolVersion,
    latencyMs: result.latencyMs,
    timestamp: result.timestamp,
  };
  return hashContentBLAKE3(normalizedResult);
}

/**
 * Verify that a tool result matches an expected digest.
 *
 * @param result - Tool result to verify
 * @param expectedDigest - Expected BLAKE3 digest
 * @returns true if digest matches
 */
export function verifyToolResultDigest(result: ToolResult, expectedDigest: string): boolean {
  const computedDigest = computeToolResultDigest(result);
  return computedDigest === expectedDigest;
}

/**
 * Compute digest for replay cache verification.
 * Combines tool name, args, and result for deterministic replay.
 */
export function computeReplayDigest(
  toolName: string,
  args: unknown,
  result: ToolResult
): string {
  const replayPayload = {
    toolName,
    args,
    result: {
      output: result.output,
      toolVersion: result.toolVersion,
      latencyMs: result.latencyMs,
      timestamp: result.timestamp,
    },
  };
  return hashContentBLAKE3(replayPayload);
}
