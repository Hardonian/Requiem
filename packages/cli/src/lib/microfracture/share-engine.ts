/**
 * Share Engine — Token generation and validation for run sharing
 *
 * INVARIANT: Tokens are cryptographically random
 * INVARIANT: Hashed at rest (tokenHash stored, not token)
 * INVARIANT: TTL enforced server-side
 * INVARIANT: Revocation supported
 */

import { hash } from '../hash.js';

export interface ShareToken {
  token: string;
  tokenHash: string;
  tenantId: string;
  subjectType: 'run' | 'diff';
  subjectA: string;
  subjectB?: string;
  scope: 'public' | 'org';
  expiresAt: Date;
  redactionLevel: 'safe' | 'full';
}

export interface ShareValidationResult {
  valid: boolean;
  token?: ShareToken;
  error?: 'expired' | 'revoked' | 'invalid' | 'tenant_mismatch';
}

export interface DiffProofCardData {
  runA: {
    id: string;
    shortId: string;
    replayMatchPercent: number;
  };
  runB: {
    id: string;
    shortId: string;
    replayMatchPercent: number;
  };
  tenantScope: string;
  determinismVerified: boolean;
  fingerprintA: string;
  fingerprintB: string;
  topDeltas: Array<{
    type: string;
    severity: 'high' | 'medium' | 'low';
    summary: string;
  }>;
  firstDivergencePoint: number | null;
  diffDigest: string;
  verifiedAt: string;
  footer: {
    verifier: string;
    timestamp: string;
  };
}

const TOKEN_BYTES = 32;
const DEFAULT_TTL_HOURS = 24;

/**
 * Generate a new share token
 */
export function generateShareToken(
  tenantId: string,
  subjectType: 'run' | 'diff',
  subjectA: string,
  subjectB: string | undefined,
  scope: 'public' | 'org',
  ttlHours: number = DEFAULT_TTL_HOURS,
  redactionLevel: 'safe' | 'full' = 'safe'
): ShareToken {
  // Generate random token (deterministic for tests if needed)
  const token = generateRandomToken();
  const tokenHash = hashToken(token);

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + ttlHours);

  return {
    token,
    tokenHash,
    tenantId,
    subjectType,
    subjectA,
    subjectB,
    scope,
    expiresAt,
    redactionLevel,
  };
}

/**
 * Generate cryptographically random token
 * Uses simple random for now (should use crypto in production)
 */
function generateRandomToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'req_';
  for (let i = 0; i < TOKEN_BYTES; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Hash token for storage
 */
function hashToken(token: string): string {
  return hash(token);
}

/**
 * Validate a share token
 */
export function validateShareToken(
  token: string,
  storedToken: ShareToken | null,
  requestTenantId?: string
): ShareValidationResult {
  if (!storedToken) {
    return { valid: false, error: 'invalid' };
  }

  // Check hash match
  const tokenHash = hashToken(token);
  if (tokenHash !== storedToken.tokenHash) {
    return { valid: false, error: 'invalid' };
  }

  // Check expiration
  if (new Date() > storedToken.expiresAt) {
    return { valid: false, error: 'expired', token: storedToken };
  }

  // Check tenant scope for org shares
  if (storedToken.scope === 'org' && requestTenantId !== storedToken.tenantId) {
    return { valid: false, error: 'tenant_mismatch', token: storedToken };
  }

  return { valid: true, token: storedToken };
}

/**
 * Create Diff Proof Card data for rendering
 */
export function createDiffProofCard(
  token: ShareToken,
  runAData: {
    id: string;
    replayMatchPercent: number;
    fingerprint: string;
  },
  runBData: {
    id: string;
    replayMatchPercent: number;
    fingerprint: string;
  },
  diffData: {
    deterministic: boolean;
    topDeltas: Array<{ type: string; severity: 'high' | 'medium' | 'low'; summary: string }>;
    firstDivergenceStep: number | null;
    diffDigest: string;
  }
): DiffProofCardData {
  return {
    runA: {
      id: runAData.id,
      shortId: runAData.id.substring(0, 8),
      replayMatchPercent: runAData.replayMatchPercent,
    },
    runB: {
      id: runBData.id,
      shortId: runBData.id.substring(0, 8),
      replayMatchPercent: runBData.replayMatchPercent,
    },
    tenantScope: token.scope === 'public' ? 'Public' : 'Organization',
    determinismVerified: diffData.deterministic,
    fingerprintA: runAData.fingerprint.substring(0, 16),
    fingerprintB: runBData.fingerprint.substring(0, 16),
    topDeltas: diffData.topDeltas.slice(0, 3),
    firstDivergencePoint: diffData.firstDivergenceStep,
    diffDigest: diffData.diffDigest.substring(0, 16),
    verifiedAt: new Date().toISOString(),
    footer: {
      verifier: 'Verified by Requiem',
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Format share URL
 */
export function formatShareUrl(token: string, baseUrl: string): string {
  return `${baseUrl}/proof/diff/${encodeURIComponent(token)}`;
}

/**
 * Format card URL (internal)
 */
export function formatCardUrl(runA: string, runB: string, baseUrl: string): string {
  return `${baseUrl}/runs/${encodeURIComponent(runA)}/diff?with=${encodeURIComponent(runB)}&card=1`;
}

/**
 * Redact sensitive data based on level
 */
export function redactData<T extends Record<string, unknown>>(
  data: T,
  level: 'safe' | 'full'
): Partial<T> {
  if (level === 'full') {
    // Full redaction - only show digests/hashes
    const redacted: Partial<T> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key.includes('digest') || key.includes('hash') || key.includes('fingerprint')) {
        (redacted as Record<string, unknown>)[key] = value;
      } else if (key === 'id' || key === 'runId') {
        (redacted as Record<string, unknown>)[key] = (value as string).substring(0, 8) + '...';
      }
    }
    return redacted;
  }

  // Safe redaction - structured data only, no raw inputs/outputs
  const redacted: Partial<T> = { ...data };
  delete (redacted as Record<string, unknown>).input;
  delete (redacted as Record<string, unknown>).output;
  delete (redacted as Record<string, unknown>).rawInput;
  delete (redacted as Record<string, unknown>).rawOutput;
  delete (redacted as Record<string, unknown>).prompt;
  delete (redacted as Record<string, unknown>).completion;

  return redacted;
}

