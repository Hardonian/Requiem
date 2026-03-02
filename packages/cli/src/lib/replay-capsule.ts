/**
 * Replay Attestation Capsule (Differentiator B)
 *
 * Portable Verifiable Run Capsule — a signed bundle containing:
 * - Semantic descriptor
 * - Policy snapshot reference
 * - Context snapshot reference
 * - Drift + integrity breakdown
 * - Transition lineage slice
 *
 * INVARIANT: Self-contained (no network required for verification).
 * INVARIANT: Cryptographically bound (checksums/signatures).
 * INVARIANT: Deterministic export format.
 */

import { hash } from './hash.js';
import {
  type SemanticState,
  type SemanticTransition,
  type DriftClassification,
  type IntegrityScoreBreakdown,
  DriftCategory,
} from './semantic-state-machine.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type CapsuleId = string & { __brand: 'CapsuleId' };

/**
 * Replay Attestation Capsule — portable verifiable run proof.
 */
export interface ReplayAttestationCapsule {
  /** Capsule format version */
  version: '1.0.0';
  /** Unique capsule ID (derived from content hash) */
  id: CapsuleId;
  /** When the capsule was created */
  createdAt: string;

  // Core content
  /** Semantic state being attested */
  semanticState: {
    id: string;
    descriptor: SemanticState['descriptor'];
    createdAt: string;
    actor: string;
    integrityScore: number;
    evidenceRefs?: string[];
  };

  // Snapshot references
  /** Policy snapshot reference */
  policySnapshot: {
    id: string;
    description?: string;
  };
  /** Context snapshot reference */
  contextSnapshot: {
    id: string;
    description?: string;
  };
  /** Optional evaluation snapshot reference */
  evalSnapshot?: {
    id: string;
    description?: string;
  };

  // Integrity signals
  /** Integrity score breakdown */
  integrityBreakdown: IntegrityScoreBreakdown;
  /** Drift classification (if transition) */
  driftClassification?: DriftClassification;

  // Lineage
  /** Transition lineage slice (ancestors) */
  lineageSlice: {
    stateId: string;
    transition?: {
      fromId?: string;
      timestamp: string;
      reason: string;
      driftCategories: string[];
    };
  }[];

  // Verification
  /** Capsule checksum (SHA-256 of canonical JSON) */
  checksum: string;
  /** Optional signature (for enterprise) */
  signature?: {
    algorithm: 'ed25519' | 'rsa-pss';
    publicKeyFingerprint: string;
    value: string;
  };
}

/**
 * Capsule verification result.
 */
export interface CapsuleVerificationResult {
  /** Whether verification passed */
  valid: boolean;
  /** Capsule ID */
  capsuleId: string;
  /** Verification timestamp */
  verifiedAt: string;
  /** Detailed checks */
  checks: {
    formatVersion: boolean;
    checksum: boolean;
    signature?: boolean;
    stateIdDerivation: boolean;
    lineageIntegrity: boolean;
  };
  /** Errors if verification failed */
  errors: string[];
  /** Summary */
  summary: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAPSULE CREATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a replay attestation capsule for a semantic state.
 *
 * @param state - The semantic state to attest
 * @param lineage - Transition lineage slice (ancestors)
 * @param policyDesc - Optional policy description
 * @param contextDesc - Optional context description
 */
export function createCapsule(
  state: SemanticState,
  lineage: Array<{ state: SemanticState; transition?: SemanticTransition }>,
  policyDesc?: string,
  contextDesc?: string
): ReplayAttestationCapsule {
  // Build capsule structure
  const capsule: Omit<ReplayAttestationCapsule, 'id' | 'checksum'> = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),

    semanticState: {
      id: state.id,
      descriptor: state.descriptor,
      createdAt: state.createdAt,
      actor: state.actor,
      integrityScore: state.integrityScore,
      evidenceRefs: state.evidenceRefs,
    },

    policySnapshot: {
      id: state.descriptor.policySnapshotId,
      description: policyDesc,
    },

    contextSnapshot: {
      id: state.descriptor.contextSnapshotId,
      description: contextDesc,
    },

    evalSnapshot: state.descriptor.evalSnapshotId ? {
      id: state.descriptor.evalSnapshotId,
    } : undefined,

    integrityBreakdown: {
      total: state.integrityScore,
      parityVerified: false,
      policyBound: state.descriptor.policySnapshotId !== '',
      contextCaptured: state.descriptor.contextSnapshotId !== '',
      evalAttached: state.descriptor.evalSnapshotId !== undefined && state.descriptor.evalSnapshotId !== '',
      replayVerified: false,
      artifactSigned: false,
    },

    lineageSlice: lineage.map(item => ({
      stateId: item.state.id,
      transition: item.transition ? {
        fromId: item.transition.fromId,
        timestamp: item.transition.timestamp,
        reason: item.transition.reason,
        driftCategories: item.transition.driftCategories,
      } : undefined,
    })),
  };

  // Compute canonical representation for hashing
  const canonical = canonicalizeCapsule(capsule);
  const checksum = computeChecksum(canonical);
  const id = deriveCapsuleId(checksum);

  return {
    ...capsule,
    id,
    checksum,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAPSULE VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verify a replay attestation capsule.
 *
 * INVARIANT: No network required.
 * INVARIANT: Fail-closed (any error = invalid).
 */
export function verifyCapsule(capsule: ReplayAttestationCapsule): CapsuleVerificationResult {
  const errors: string[] = [];
  const checks = {
    formatVersion: false,
    checksum: false,
    stateIdDerivation: false,
    lineageIntegrity: false,
  };

  // Check format version
  if (capsule.version === '1.0.0') {
    checks.formatVersion = true;
  } else {
    errors.push(`Unsupported capsule version: ${capsule.version}`);
  }

  // Verify checksum
  try {
    const { id, checksum, signature, ...capsuleWithoutId } = capsule;
    const canonical = canonicalizeCapsule(capsuleWithoutId as Omit<ReplayAttestationCapsule, 'id' | 'checksum'>);
    const expectedChecksum = computeChecksum(canonical);

    if (capsule.checksum === expectedChecksum) {
      checks.checksum = true;
    } else {
      errors.push('Checksum mismatch — capsule may be tampered');
    }
  } catch (e) {
    errors.push(`Checksum computation failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Verify state ID derivation (optional but recommended)
  try {
    // Recompute state ID from descriptor
    const { hash } = require('./hash.js');
    const canonicalDesc = JSON.stringify(capsule.semanticState.descriptor, Object.keys(capsule.semanticState.descriptor).sort());
    const expectedStateId = hash(canonicalDesc);

    if (capsule.semanticState.id === expectedStateId) {
      checks.stateIdDerivation = true;
    } else {
      errors.push('State ID does not match descriptor hash');
    }
  } catch {
    // Don't fail on this check if hash module issues
  }

  // Verify lineage integrity
  try {
    const lineageValid = verifyLineageIntegrity(capsule.lineageSlice);
    checks.lineageIntegrity = lineageValid;
    if (!lineageValid) {
      errors.push('Lineage integrity check failed');
    }
  } catch (e) {
    errors.push(`Lineage verification failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Verify signature if present (placeholder for enterprise)
  if (capsule.signature) {
    // Signature verification would go here
    // For now, we just note it would be checked
    checks.signature = false;
    errors.push('Signature verification not implemented in OSS version');
  }

  const allValid = Object.values(checks).every(v => v === true || v === undefined);

  return {
    valid: allValid && errors.length === 0,
    capsuleId: capsule.id,
    verifiedAt: new Date().toISOString(),
    checks,
    errors,
    summary: allValid && errors.length === 0
      ? 'Capsule verification passed — all checks valid'
      : `Capsule verification failed with ${errors.length} error(s)`,
  };
}

/**
 * Quick verify — just checks checksum and format.
 */
export function quickVerifyCapsule(capsule: ReplayAttestationCapsule): boolean {
  try {
    if (capsule.version !== '1.0.0') return false;

    const { id, checksum, ...capsuleWithoutId } = capsule;
    const canonical = canonicalizeCapsule(capsuleWithoutId as Omit<ReplayAttestationCapsule, 'id' | 'checksum'>);
    const expectedChecksum = computeChecksum(canonical);

    return capsule.checksum === expectedChecksum;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Serialize capsule to JSON.
 */
export function serializeCapsule(capsule: ReplayAttestationCapsule): string {
  return JSON.stringify(capsule, null, 2);
}

/**
 * Deserialize capsule from JSON.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deserializeCapsule(json: string): ReplayAttestationCapsule {
  const parsed = JSON.parse(json);

  // Basic validation
  if (!parsed.version || !parsed.id || !parsed.checksum) {
    throw new Error('Invalid capsule: missing required fields');
  }

  return parsed as ReplayAttestationCapsule;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function canonicalizeCapsule(
  capsule: Omit<ReplayAttestationCapsule, 'id' | 'checksum'> | ReplayAttestationCapsule
): string {
  // Sort keys for deterministic hashing
  return JSON.stringify(capsule, Object.keys(capsule).sort());
}

function computeChecksum(canonical: string): string {
  // Use the same hash function as SSM for consistency
  return hash(canonical);
}

function deriveCapsuleId(checksum: string): CapsuleId {
  // Capsule ID is derived from checksum for content-addressing
  return `capsule-${checksum.substring(0, 32)}` as CapsuleId;
}

function verifyLineageIntegrity(
  lineage: ReplayAttestationCapsule['lineageSlice']
): boolean {
  if (lineage.length === 0) return true;

  // Verify chain integrity: each state's transition should point to previous
  for (let i = 1; i < lineage.length; i++) {
    const current = lineage[i];
    const previous = lineage[i - 1];

    if (current.transition?.fromId !== previous.stateId) {
      return false;
    }
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAPSULE METADATA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract human-readable summary from capsule.
 */
export function getCapsuleSummary(capsule: ReplayAttestationCapsule): {
  id: string;
  stateId: string;
  model: string;
  integrity: number;
  lineageDepth: number;
  createdAt: string;
} {
  return {
    id: capsule.id,
    stateId: capsule.semanticState.id,
    model: `${capsule.semanticState.descriptor.modelId}@${capsule.semanticState.descriptor.modelVersion || 'latest'}`,
    integrity: capsule.integrityBreakdown.total,
    lineageDepth: capsule.lineageSlice.length,
    createdAt: capsule.createdAt,
  };
}

/**
 * Check if capsule contains specific drift category.
 */
export function capsuleHasDrift(
  capsule: ReplayAttestationCapsule,
  category: DriftCategory
): boolean {
  if (!capsule.driftClassification) return false;
  return capsule.driftClassification.driftCategories.includes(category);
}
