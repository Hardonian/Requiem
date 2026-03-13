/**
 * Canonical Hash Pipeline
 *
 * Standardized hashing across the Requiem system:
 * - BLAKE3-256 everywhere (SHA-256 fallback when native unavailable)
 * - Canonical JSON serialization with stable key ordering
 * - UTF-8 normalization
 * - Newline normalization (CRLF → LF)
 * - Domain-separated hashing matching C++ kernel
 *
 * This module is the single source of truth for all hashing operations
 * in the TypeScript layer. The C++ kernel uses an identical algorithm
 * in /kernel/hash/canonical_hash.cpp.
 */

import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Algorithm Selection
// ---------------------------------------------------------------------------

export const HASH_ALGORITHM = 'blake3' as const;
export const HASH_ALGORITHM_VERSION = 1;

type HashFn = (input: string | Buffer) => string;

let _hashFn: HashFn | undefined;
let _activeAlgorithm: 'blake3' | 'sha256' = 'blake3';

function getHashFn(): HashFn {
  if (_hashFn) return _hashFn;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const blake3 = require('blake3');
    _hashFn = (input: string | Buffer): string => {
      const buf = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
      return blake3.hash(buf).toString('hex');
    };
    _activeAlgorithm = 'blake3';
  } catch {
    _hashFn = (input: string | Buffer): string => {
      return createHash('sha256').update(input).digest('hex');
    };
    _activeAlgorithm = 'sha256';
  }
  return _hashFn;
}

// ---------------------------------------------------------------------------
// UTF-8 and Newline Normalization
// ---------------------------------------------------------------------------

/** Normalize string to NFC form and convert CRLF/CR to LF */
export function normalizeText(input: string): string {
  // NFC normalization for consistent Unicode representation
  const nfc = input.normalize('NFC');
  // Normalize line endings: CRLF → LF, lone CR → LF
  return nfc.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// ---------------------------------------------------------------------------
// Canonical JSON Serialization
// ---------------------------------------------------------------------------

export type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('Non-finite numbers are not supported in canonical JSON');
  }
  if (Object.is(value, -0)) return 0;
  return Number(value.toString());
}

function normalizeValue(value: unknown): CanonicalJsonValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return normalizeNumber(value);
  if (typeof value === 'string') return normalizeText(value);
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, normalizeValue(v)] as const);
    return Object.fromEntries(entries);
  }
  throw new Error(`Unsupported canonical JSON value type: ${typeof value}`);
}

/** Produce deterministic canonical JSON: sorted keys, no whitespace, NFC-normalized strings */
export function canonicalStringify(value: unknown): string {
  return JSON.stringify(normalizeValue(value));
}

// ---------------------------------------------------------------------------
// Core Hash Functions
// ---------------------------------------------------------------------------

/** Canonical hash — BLAKE3-256 (64 hex chars) with SHA-256 fallback */
export function canonicalHash(input: string | Buffer): string {
  return getHashFn()(input);
}

/** Hash with domain separation prefix (matches C++ kernel) */
export function hashDomain(domain: string, payload: string): string {
  return getHashFn()(domain + payload);
}

/** Hash a value after canonical JSON serialization */
export function hashCanonical(value: unknown): string {
  return canonicalHash(canonicalStringify(value));
}

// ---------------------------------------------------------------------------
// Domain-Specific Hash Functions
// ---------------------------------------------------------------------------

/** Request digest — domain "req:" */
export function requestDigest(canonicalJson: string): string {
  return hashDomain('req:', canonicalJson);
}

/** Result digest — domain "res:" */
export function resultDigest(canonicalJson: string): string {
  return hashDomain('res:', canonicalJson);
}

/** CAS content hash — domain "cas:" */
export function casContentHash(payload: string | Buffer): string {
  const content = typeof payload === 'string' ? payload : payload.toString();
  return hashDomain('cas:', content);
}

/** Event chain hash — domain "evt:" */
export function eventChainHash(eventJson: string): string {
  return hashDomain('evt:', eventJson);
}

/** Policy proof hash — domain "pol:" */
export function policyProofHash(decisionJson: string): string {
  return hashDomain('pol:', decisionJson);
}

/** Receipt hash — domain "rcpt:" */
export function receiptHash(receiptJson: string): string {
  return hashDomain('rcpt:', receiptJson);
}

/** Plan hash — domain "plan:" */
export function planHash(planJson: string): string {
  return hashDomain('plan:', planJson);
}

/** Capability hash — domain "cap:" */
export function capabilityHash(capJson: string): string {
  return hashDomain('cap:', capJson);
}

// ---------------------------------------------------------------------------
// Runtime Info
// ---------------------------------------------------------------------------

export interface HashRuntimeInfo {
  algorithm: string;
  version: number;
  blake3_available: boolean;
  fallback_active: boolean;
}

export function hashRuntimeInfo(): HashRuntimeInfo {
  getHashFn(); // ensure initialized
  return {
    algorithm: _activeAlgorithm,
    version: HASH_ALGORITHM_VERSION,
    blake3_available: _activeAlgorithm === 'blake3',
    fallback_active: _activeAlgorithm === 'sha256',
  };
}

// ---------------------------------------------------------------------------
// Verification Utilities
// ---------------------------------------------------------------------------

/** Verify that a digest matches expected content */
export function verifyDigest(
  content: string | Buffer,
  expectedDigest: string,
  domain?: string,
): boolean {
  const computed = domain
    ? hashDomain(domain, typeof content === 'string' ? content : content.toString())
    : canonicalHash(content);
  return computed === expectedDigest;
}

/** Compute Merkle root from a list of digests */
export function computeMerkleRoot(digests: string[]): string {
  if (digests.length === 0) return canonicalHash('empty_tree');
  if (digests.length === 1) return digests[0];

  const pairs: string[] = [];
  for (let i = 0; i < digests.length; i += 2) {
    const left = digests[i];
    const right = i + 1 < digests.length ? digests[i + 1] : left;
    pairs.push(canonicalHash(left + right));
  }
  return computeMerkleRoot(pairs);
}
