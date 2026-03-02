/**
 * Branded Types — Compile-time enforcement of semantic distinctions.
 *
 * INVARIANT: Identifiers with different semantic meaning are never interchangeable.
 * INVARIANT: No implicit string assignment to branded types.
 *
 * Branded types prevent accidental swaps (e.g. passing a RunId where a Fingerprint is expected).
 */

// ─── Brand infrastructure ─────────────────────────────────────────────────────

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

// ─── Branded ID types ──────────────────────────────────────────────────────────

/** Unique identifier for an execution run */
export type RunId = Brand<string, 'RunId'>;

/** Deterministic content fingerprint (BLAKE3 hex) */
export type Fingerprint = Brand<string, 'Fingerprint'>;

/** Policy snapshot hash */
export type PolicySnapshotHash = Brand<string, 'PolicySnapshotHash'>;

/** Decision report identifier */
export type DecisionId = Brand<string, 'DecisionId'>;

/** Junction identifier */
export type JunctionId = Brand<string, 'JunctionId'>;

/** Tenant identifier */
export type TenantId = Brand<string, 'TenantId'>;

/** Ledger entry identifier */
export type LedgerId = Brand<string, 'LedgerId'>;

/** CAS content hash */
export type CASDigest = Brand<string, 'CASDigest'>;

// ─── Constructors (validated entry points) ─────────────────────────────────────

const HEX_64 = /^[a-f0-9]{64}$/;
const ID_PREFIX = /^[a-z]+_[a-zA-Z0-9]+$/;

export function createRunId(raw: string): RunId {
  if (!raw || raw.length === 0) {
    throw new Error('RunId cannot be empty');
  }
  return raw as RunId;
}

export function createFingerprint(raw: string): Fingerprint {
  if (!HEX_64.test(raw)) {
    throw new Error(`Invalid fingerprint: expected 64 hex chars, got "${raw.substring(0, 20)}..."`);
  }
  return raw as Fingerprint;
}

export function createPolicySnapshotHash(raw: string): PolicySnapshotHash {
  if (!HEX_64.test(raw)) {
    throw new Error(`Invalid policy snapshot hash: expected 64 hex chars, got "${raw.substring(0, 20)}..."`);
  }
  return raw as PolicySnapshotHash;
}

export function createDecisionId(raw: string): DecisionId {
  if (!raw || raw.length === 0) {
    throw new Error('DecisionId cannot be empty');
  }
  return raw as DecisionId;
}

export function createJunctionId(raw: string): JunctionId {
  if (!raw || raw.length === 0) {
    throw new Error('JunctionId cannot be empty');
  }
  return raw as JunctionId;
}

export function createTenantId(raw: string): TenantId {
  if (!raw || raw.length === 0) {
    throw new Error('TenantId cannot be empty');
  }
  return raw as TenantId;
}

export function createLedgerId(raw: string): LedgerId {
  if (!raw || raw.length === 0) {
    throw new Error('LedgerId cannot be empty');
  }
  return raw as LedgerId;
}

export function createCASDigest(raw: string): CASDigest {
  if (!HEX_64.test(raw)) {
    throw new Error(`Invalid CAS digest: expected 64 hex chars, got "${raw.substring(0, 20)}..."`);
  }
  return raw as CASDigest;
}

// ─── Unsafe cast (for migration / boundary layers) ─────────────────────────────

/**
 * Unsafe cast for boundary layers where raw strings come from external sources
 * (DB, CLI args, etc). Prefer validated constructors above for new code.
 */
export function unsafeCast<T>(raw: string): T {
  return raw as unknown as T;
}

// ─── Discriminated unions for decision types ────────────────────────────────────

/**
 * Arbitration decision result — discriminated union.
 * INVARIANT: Every arbitration decision has exactly one of these shapes.
 */
export type ArbitrationDecision =
  | { readonly kind: 'accept'; readonly action: string; readonly confidence: number }
  | { readonly kind: 'reject'; readonly reason: string }
  | { readonly kind: 'defer'; readonly deferUntil: string; readonly reason: string }
  | { readonly kind: 'investigate'; readonly evidence: string[] };

/**
 * Policy evaluation result — discriminated union.
 * INVARIANT: Every policy evaluation has exactly one of these shapes.
 */
export type PolicyResult =
  | { readonly kind: 'allow'; readonly policyHash: PolicySnapshotHash }
  | { readonly kind: 'deny'; readonly reason: string; readonly policyHash: PolicySnapshotHash }
  | { readonly kind: 'require_approval'; readonly approver: string; readonly policyHash: PolicySnapshotHash };

/**
 * Entitlement state — discriminated union.
 * INVARIANT: Entitlement is always in exactly one of these states.
 */
export type EntitlementState =
  | { readonly kind: 'active'; readonly expiresAt: string }
  | { readonly kind: 'expired'; readonly expiredAt: string }
  | { readonly kind: 'suspended'; readonly reason: string; readonly suspendedAt: string }
  | { readonly kind: 'trial'; readonly trialEndsAt: string; readonly usagePercent: number };

// Suppress unused warning for ID_PREFIX (reserved for future validation)
void ID_PREFIX;
