/**
 * @fileoverview CAS Signing Integration
 *
 * Integrates artifact signing into the CAS storage layer.
 * Signatures are written alongside CAS objects.
 *
 * INVARIANT: Always-on by default for artifacts produced by runs.
 * INVARIANT: Graceful degradation if signing fails.
 * INVARIANT: Signatures verified at read boundaries.
 */

import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { signContent, verifyContent, isSigningEnabled, type ArtifactSignature, type VerificationResult } from './signing';
import { logger } from '../telemetry/logger';

// ─── Path Configuration ────────────────────────────────────────────────────────

function getCASDir(): string {
  return process.env['REQUIEM_CAS_DIR'] || 
         process.env['REQUIEM_DATA_DIR'] || 
         join(process.cwd(), '.data', 'cas');
}

// ─── CAS Object Paths ───────────────────────────────────────────────────────────

/**
 * Get the path for a CAS object
 */
export function getCASObjectPath(contentHash: string): string {
  const casDir = getCASDir();
  const subdir = contentHash.slice(0, 2);
  const objectDir = join(casDir, 'objects', subdir);
  
  if (!existsSync(objectDir)) {
    mkdirSync(objectDir, { recursive: true });
  }
  
  return join(objectDir, contentHash.slice(2));
}

/**
 * Get the path for a CAS object signature
 */
export function getCASSignaturePath(contentHash: string): string {
  return getCASObjectPath(contentHash) + '.sig';
}

// ─── CAS Write with Signature ─────────────────────────────────────────────────

/**
 * Write a CAS object with integrated signature
 */
export async function writeSignedCASObject(
  content: Buffer | string,
  contentHash: string,
  tenantId: string,
  contentType = 'application/octet-stream'
): Promise<{ objectPath: string; signaturePath: string; signature: ArtifactSignature | null }> {
  const objectPath = getCASObjectPath(contentHash);
  const signaturePath = getCASSignaturePath(contentHash);

  // Write the content
  const contentBuffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  
  // Ensure directory exists
  const dir = dirname(objectPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Write content
  writeFileSync(objectPath, contentBuffer);

  // Sign and write signature (if enabled)
  let signature: ArtifactSignature | null = null;
  
  if (isSigningEnabled()) {
    try {
      signature = await signContent(contentBuffer, contentHash, tenantId);
      
      // Write signature to .sig file
      const sigData = JSON.stringify(signature, null, 2);
      writeFileSync(signaturePath, sigData, 'utf8');
      
      logger.debug('[cas-signing] signed object', { contentHash, keyId: signature.keyId });
    } catch (err) {
      // Graceful degradation: log error but don't fail
      logger.warn('[cas-signing] failed to sign object, continuing without signature', {
        contentHash,
        error: String(err),
      });
    }
  }

  return { objectPath, signaturePath, signature };
}

/**
 * Read a CAS object and verify its signature
 */
export async function readVerifiedCASObject(
  contentHash: string
): Promise<{ content: Buffer; signature: ArtifactSignature | null; verified: boolean }> {
  const objectPath = getCASObjectPath(contentHash);
  const signaturePath = getCASSignaturePath(contentHash);

  if (!existsSync(objectPath)) {
    throw new Error(`CAS object not found: ${contentHash}`);
  }

  const content = readFileSync(objectPath);

  // Try to load and verify signature
  let signature: ArtifactSignature | null = null;
  let verified = false;

  if (existsSync(signaturePath)) {
    try {
      const sigData = readFileSync(signaturePath, 'utf8');
      signature = JSON.parse(sigData) as ArtifactSignature;
      
      if (isSigningEnabled()) {
        const result = await verifyContent(content, signature);
        verified = result.valid;
        
        if (!verified) {
          logger.warn('[cas-signing] signature verification failed', {
            contentHash,
            error: result.error,
          });
        }
      } else {
        // Signing disabled, skip verification but return signature
        verified = true;
      }
    } catch (err) {
      logger.warn('[cas-signing] failed to verify signature', {
        contentHash,
        error: String(err),
      });
      verified = false;
    }
  } else {
    // No signature file - this is expected for objects written before signing was enabled
    logger.debug('[cas-signing] no signature found for object', { contentHash });
  }

  return { content, signature, verified };
}

/**
 * Verify a CAS object without reading it
 */
export async function verifyCASObjectSignature(contentHash: string): Promise<VerificationResult> {
  const signaturePath = getCASSignaturePath(contentHash);

  if (!existsSync(signaturePath)) {
    return {
      valid: false,
      error: 'No signature file found',
      details: {
        artifactHash: contentHash,
        algorithm: 'hmac-sha256',
        keyId: '',
        signedAt: '',
      },
    };
  }

  // Read the signature
  const sigData = readFileSync(signaturePath, 'utf8');
  const signature = JSON.parse(sigData) as ArtifactSignature;

  // Read the content
  const objectPath = getCASObjectPath(contentHash);
  if (!existsSync(objectPath)) {
    return {
      valid: false,
      error: 'CAS object not found',
      details: {
        artifactHash: contentHash,
        algorithm: signature.algorithm,
        keyId: signature.keyId,
        signedAt: signature.signedAt,
      },
    };
  }

  const content = readFileSync(objectPath);
  return verifyContent(content, signature);
}

/**
 * Check if a CAS object has a signature
 */
export function hasCASObjectSignature(contentHash: string): boolean {
  const signaturePath = getCASSignaturePath(contentHash);
  return existsSync(signaturePath);
}

/**
 * Get CAS object metadata including signature info
 */
export function getCASObjectMetadata(contentHash: string): {
  exists: boolean;
  hasSignature: boolean;
  signaturePath?: string;
  objectPath?: string;
} {
  const objectPath = getCASObjectPath(contentHash);
  const signaturePath = getCASSignaturePath(contentHash);

  return {
    exists: existsSync(objectPath),
    hasSignature: existsSync(signaturePath),
    objectPath: existsSync(objectPath) ? objectPath : undefined,
    signaturePath: existsSync(signaturePath) ? signaturePath : undefined,
  };
}
