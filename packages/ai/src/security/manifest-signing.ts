/**
 * @fileoverview Run Manifest Signing
 *
 * Signs run manifests to provide provenance and integrity verification.
 * Integrated into replay and bugreport redaction pipeline.
 *
 * INVARIANT: Always-on by default for artifacts produced by runs.
 * INVARIANT: Deterministic and reproducible.
 * INVARIANT: Enforced at read/serve/replay boundaries.
 */

import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { signRunManifest, verifyRunManifest, type ManifestSignature, type VerificationResult, isSigningEnabled } from './signing';
import { logger } from '../telemetry/logger';

// ─── Path Configuration ────────────────────────────────────────────────────────

function getDataDir(): string {
  return process.env['REQUIEM_DATA_DIR'] || 
         join(process.cwd(), '.data');
}

// ─── Manifest Types ───────────────────────────────────────────────────────────

/**
 * Run manifest structure
 */
export interface RunManifest {
  /** Unique run ID */
  runId: string;
  /** Tenant ID */
  tenantId: string;
  /** Run status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  /** Input fingerprint (SHA-256) */
  inputFingerprint: string;
  /** Output fingerprint (SHA-256) */
  outputFingerprint: string;
  /** Result digest */
  resultDigest: string;
  /** Engine version */
  engineVersion: string;
  /** Dependency snapshot hash */
  dependencySnapshotHash: string;
  /** When the run started */
  startedAt: string;
  /** When the run ended */
  endedAt?: string;
  /** Steps in the run */
  steps: RunStep[];
  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * Run step in a manifest
 */
export interface RunStep {
  /** Step ID */
  stepId: string;
  /** Step name */
  name: string;
  /** Status */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** Input hash */
  inputHash: string;
  /** Output hash */
  outputHash: string;
  /** Tool used */
  tool?: string;
  /** Tool version */
  toolVersion?: string;
  /** Duration in ms */
  durationMs?: number;
  /** Error if failed */
  error?: string;
}

// ─── Manifest Paths ─────────────────────────────────────────────────────────

/**
 * Get the path for a run manifest
 */
export function getManifestPath(runId: string): string {
  const dataDir = getDataDir();
  const runsDir = join(dataDir, 'runs');
  return join(runsDir, runId, 'manifest.json');
}

/**
 * Get the path for a manifest signature
 */
export function getManifestSignaturePath(runId: string): string {
  return getManifestPath(runId) + '.sig';
}

// ─── Manifest Write with Signature ───────────────────────────────────────────

/**
 * Write a signed run manifest
 */
export async function writeSignedRunManifest(
  manifest: RunManifest
): Promise<{ manifestPath: string; signaturePath: string; signature: ManifestSignature | null }> {
  const manifestPath = getManifestPath(manifest.runId);
  const signaturePath = getManifestSignaturePath(manifest.runId);

  // Ensure directory exists
  const dir = join(dirname(manifestPath));
  const fs = await import('fs');
  if (!existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write manifest
  const manifestData = JSON.stringify(manifest, null, 2);
  writeFileSync(manifestPath, manifestData, 'utf8');

  // Sign manifest (if enabled)
  let signature: ManifestSignature | null = null;

  if (isSigningEnabled()) {
    try {
      signature = await signRunManifest(manifest, manifest.runId);
      
      // Write signature
      const sigData = JSON.stringify(signature, null, 2);
      writeFileSync(signaturePath, sigData, 'utf8');
      
      logger.debug('[manifest-signing] signed manifest', { runId: manifest.runId, keyId: signature.keyId });
    } catch (err) {
      logger.warn('[manifest-signing] failed to sign manifest, continuing without signature', {
        runId: manifest.runId,
        error: String(err),
      });
    }
  }

  return { manifestPath, signaturePath, signature };
}

// ─── Manifest Read with Verification ─────────────────────────────────────────

/**
 * Read a run manifest and verify its signature
 */
export async function readVerifiedRunManifest(
  runId: string
): Promise<{ manifest: RunManifest; signature: ManifestSignature | null; verified: boolean }> {
  const manifestPath = getManifestPath(runId);
  const signaturePath = getManifestSignaturePath(runId);

  if (!existsSync(manifestPath)) {
    throw new Error(`Run manifest not found: ${runId}`);
  }

  // Read manifest
  const manifestData = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestData) as RunManifest;

  // Try to load and verify signature
  let signature: ManifestSignature | null = null;
  let verified = false;

  if (existsSync(signaturePath)) {
    try {
      const sigData = readFileSync(signaturePath, 'utf8');
      signature = JSON.parse(sigData) as ManifestSignature;
      
      if (isSigningEnabled()) {
        const result = await verifyRunManifest(manifest, signature);
        verified = result.valid;
        
        if (!verified) {
          logger.warn('[manifest-signing] signature verification failed', {
            runId,
            error: result.error,
          });
        }
      } else {
        // Signing disabled, skip verification
        verified = true;
      }
    } catch (err) {
      logger.warn('[manifest-signing] failed to verify signature', {
        runId,
        error: String(err),
      });
      verified = false;
    }
  } else {
    logger.debug('[manifest-signing] no signature found for manifest', { runId });
  }

  return { manifest, signature, verified };
}

/**
 * Verify a run manifest signature without reading the full manifest
 */
export async function verifyRunManifestSignature(runId: string): Promise<VerificationResult> {
  const signaturePath = getManifestSignaturePath(runId);

  if (!existsSync(signaturePath)) {
    return {
      valid: false,
      error: 'No signature file found',
      details: {
        artifactHash: '',
        algorithm: 'hmac-sha256',
        keyId: '',
        signedAt: '',
      },
    };
  }

  // Read signature
  const sigData = readFileSync(signaturePath, 'utf8');
  const signature = JSON.parse(sigData) as ManifestSignature;

  // Read manifest
  const manifestPath = getManifestPath(runId);
  if (!existsSync(manifestPath)) {
    return {
      valid: false,
      error: 'Manifest not found',
      details: {
        artifactHash: '',
        algorithm: signature.algorithm,
        keyId: signature.keyId,
        signedAt: signature.signedAt,
      },
    };
  }

  const manifestData = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestData);

  return verifyRunManifest(manifest, signature);
}

/**
 * Check if a run manifest has a signature
 */
export function hasRunManifestSignature(runId: string): boolean {
  return existsSync(getManifestSignaturePath(runId));
}

// ─── Manifest Creation Helper ───────────────────────────────────────────────

/**
 * Create a run manifest from execution data
 */
export function createRunManifest(params: {
  runId: string;
  tenantId: string;
  status: RunManifest['status'];
  inputFingerprint: string;
  outputFingerprint: string;
  resultDigest: string;
  engineVersion: string;
  dependencySnapshotHash: string;
  startedAt: string;
  endedAt?: string;
  steps: RunStep[];
  metadata?: Record<string, unknown>;
}): RunManifest {
  return {
    runId: params.runId,
    tenantId: params.tenantId,
    status: params.status,
    inputFingerprint: params.inputFingerprint,
    outputFingerprint: params.outputFingerprint,
    resultDigest: params.resultDigest,
    engineVersion: params.engineVersion,
    dependencySnapshotHash: params.dependencySnapshotHash,
    startedAt: params.startedAt,
    endedAt: params.endedAt,
    steps: params.steps,
    metadata: params.metadata || {},
  };
}

// ─── Verification at Boundaries ─────────────────────────────────────────────

/**
 * Verify artifact integrity at read boundary
 */
export async function verifyArtifactAtRead(artifactHash: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  // Import dynamically to avoid circular dependencies
  const { verifyCASObjectSignature } = await import('./cas-signing');
  
  const result = await verifyCASObjectSignature(artifactHash);
  return {
    valid: result.valid,
    error: result.error,
  };
}

/**
 * Verify manifest integrity at serve/replay boundary
 */
export async function verifyManifestAtServe(runId: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  const result = await verifyRunManifestSignature(runId);
  return {
    valid: result.valid,
    error: result.error,
  };
}
