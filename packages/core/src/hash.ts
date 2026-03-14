import { createHash } from 'node:crypto';
import { canonicalStringify } from './canonical-json.js';

// ---------------------------------------------------------------------------
// Hash Algorithm Selection
// ---------------------------------------------------------------------------
// The Requiem platform uses a SINGLE canonical hash algorithm: BLAKE3-256.
// All content-addressed storage, event chains, policy proofs, and execution
// digests MUST use this algorithm. SHA-256 is retained ONLY as a fallback
// when the native blake3 module is unavailable (e.g. restricted environments).
//
// Domain separation prefixes match the C++ kernel:
//   "req:" — execution request digests
//   "res:" — execution result digests
//   "cas:" — content-addressable storage keys
//   "evt:" — event log chain hashes
//   "pol:" — policy evaluation proofs
// ---------------------------------------------------------------------------

export const HASH_ALGORITHM = 'blake3' as const;
export const HASH_VERSION = 1;

type HashFn = (input: string | Buffer) => string;

let _hashFn: HashFn | undefined;
let _activeAlgorithm: 'blake3' | 'sha256' = 'blake3';

function getHashFn(): HashFn {
  if (_hashFn) return _hashFn;
  try {
    // Runtime require via eval prevents webpack from trying to bundle blake3's ESM entry.
    // eslint-disable-next-line no-eval
    const runtimeRequire = eval('require') as NodeJS.Require;
    const blake3 = runtimeRequire('blake3');
    _hashFn = (input: string | Buffer): string => {
      const buf = typeof input === 'string' ? Buffer.from(input) : input;
      return blake3.hash(buf).toString('hex');
    };
    _activeAlgorithm = 'blake3';
  } catch {
    // Fallback: SHA-256 (only when blake3 native addon unavailable)
    _hashFn = (input: string | Buffer): string => {
      return createHash('sha256').update(input).digest('hex');
    };
    _activeAlgorithm = 'sha256';
  }
  return _hashFn;
}

/** Canonical hash — BLAKE3-256 (64 hex chars) with SHA-256 fallback */
export function blake3Hex(input: string | Buffer): string {
  return getHashFn()(input);
}

/** @deprecated Use blake3Hex() — retained for backward compatibility */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Hash with domain separation prefix (matches C++ kernel) */
export function hashDomain(domain: string, payload: string): string {
  return getHashFn()(domain + payload);
}

/** Hash a canonicalized value */
export function hashCanonical(value: unknown): string {
  return blake3Hex(canonicalStringify(value));
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

/** Runtime info about active hash configuration */
export function hashRuntimeInfo(): {
  algorithm: string;
  version: number;
  blake3_available: boolean;
  fallback_active: boolean;
} {
  getHashFn(); // ensure initialized
  return {
    algorithm: _activeAlgorithm,
    version: HASH_VERSION,
    blake3_available: _activeAlgorithm === 'blake3',
    fallback_active: _activeAlgorithm === 'sha256',
  };
}
