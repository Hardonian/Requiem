/**
 * Hash utilities — unified BLAKE3-256 with domain separation
 *
 * This module is the single source of truth for hashing in the TypeScript
 * layer. It mirrors the C++ kernel's domain-separated BLAKE3 scheme:
 *
 *   "req:" — request digests
 *   "res:" — result digests
 *   "cas:" — CAS content keys
 *   "evt:" — event chain hashes
 *   "pol:" — policy proof hashes
 */

import { hash as blake3Hash } from 'blake3';

/** Canonical BLAKE3-256 hash (64 hex chars) */
export function hash(data: string | Buffer): string {
  const content = typeof data === 'string' ? Buffer.from(data) : data;
  return blake3Hash(content).toString('hex');
}

/** Domain-separated hash (matches C++ kernel's hash_domain) */
export function hashDomain(domain: string, payload: string): string {
  return hash(domain + payload);
}

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

export interface HashBridge {
  artifact_hash: string;
  runtime_hash: string;
  canonical_hash: string;
}

/** Create hash bridge — all fields now use BLAKE3 */
export function createHashBridge(data: string | Buffer): HashBridge {
  const h = hash(data);
  return {
    artifact_hash: h,
    runtime_hash: h,
    canonical_hash: h,
  };
}

/** Truncated hash for display (first 16 chars) */
export function hashShort(data: string | Buffer): string {
  return hash(data).substring(0, 16);
}
