// ready-layer/src/lib/auth.ts
//
// BOUNDARY CONTRACT: Node API <-> Next.js - Authentication + Tenant validation

import { NextRequest, NextResponse } from 'next/server';
import type { TenantContext } from './engine-client';
import { problemResponse } from './problem-json';
import {
  createInternalAuthProof,
  INTERNAL_AUTH_PROOF_HEADER,
  secureEqualHex,
} from './internal-auth-proof';
import { verifyDirectBearerToken } from './direct-bearer';

export type AuthDecisionEvidence = {
  version: 'v1';
  decision: 'allow' | 'deny';
  mode: 'none' | 'direct_bearer' | 'internal_proof' | 'route_verify' | 'test_fixture' | 'local_dev';
  reason: string;
  tenant_id?: string;
  actor_id?: string;
  identity_source?: 'token_claims' | 'signed_internal_context' | 'explicit_test_fixture' | 'none';
};

export interface AuthResult {
  ok: boolean;
  tenant?: TenantContext;
  actor_id?: string;
  error?: string;
  status?: number;
  evidence?: AuthDecisionEvidence;
}

function evidence(
  decision: AuthDecisionEvidence['decision'],
  mode: AuthDecisionEvidence['mode'],
  reason: string,
  identity?: { tenant_id?: string; actor_id?: string; identity_source?: AuthDecisionEvidence['identity_source'] },
): AuthDecisionEvidence {
  return { version: 'v1', decision, mode, reason, ...identity };
}

const PUBLIC_ROUTES = new Set([
  '/api/health',
  '/api/readiness',
  '/api/openapi.json',
  '/api/status',
  '/',
  '/pricing',
  '/docs',
]);

const STRICT_AUTH_ENVS = new Set(['production', 'staging', 'test']);

export function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  if (pathname.startsWith('/_next/') || pathname.startsWith('/static/')) return true;
  return false;
}

function resolveTenantId(req: NextRequest): string | null {
  const tenant = req.headers.get('x-tenant-id');
  if (tenant && tenant.trim()) return tenant.trim();
  return null;
}

export function isStrictAuthMode(): boolean {
  const authMode = process.env.REQUIEM_AUTH_MODE?.toLowerCase();
  if (authMode === 'strict') return true;
  if (authMode === 'local-dev') return false;
  return STRICT_AUTH_ENVS.has(process.env.NODE_ENV ?? 'development');
}

function isProductionLikeAuthRuntime(): boolean {
  const runtime = process.env.NODE_ENV as string | undefined;
  return runtime === 'production' || runtime === 'staging';
}

function allowInsecureDevAuth(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.REQUIEM_ALLOW_INSECURE_DEV_AUTH === '1';
}

export function getAuthReadiness(): {
  strict_mode: boolean;
  bearer_secret_present: boolean;
  internal_proof_secret_present: boolean;
  proof_operational: boolean;
} {
  const strictMode = isStrictAuthMode();
  const bearerSecretPresent = Boolean(process.env.REQUIEM_AUTH_SECRET?.trim());
  const internalProofSecretPresent = Boolean(
    process.env.REQUIEM_AUTH_INTERNAL_SECRET?.trim() || process.env.REQUIEM_AUTH_SECRET?.trim(),
  );

  return {
    strict_mode: strictMode,
    bearer_secret_present: bearerSecretPresent,
    internal_proof_secret_present: internalProofSecretPresent,
    proof_operational: internalProofSecretPresent,
  };
}

async function hasValidInternalAuthProof(req: NextRequest, tenantId: string, actorId: string): Promise<boolean> {
  const proof = req.headers.get(INTERNAL_AUTH_PROOF_HEADER);
  if (!proof) return false;
  const pathname = 'nextUrl' in req && req.nextUrl?.pathname
    ? req.nextUrl.pathname
    : new URL(req.url).pathname;

  const expected = await createInternalAuthProof({
    tenantId,
    actorId,
    method: req.method,
    pathname,
  });
  if (!expected) return false;
  return secureEqualHex(expected, proof);
}

export async function validateTenantAuth(req: NextRequest): Promise<AuthResult> {
  const tenantHeader = resolveTenantId(req);
  const middlewareAuthenticated = req.headers.get('x-requiem-authenticated') === '1';
  const actorId = req.headers.get('x-user-id')?.trim() ?? '';
  const presentedInternalHeaders =
    middlewareAuthenticated
    || Boolean(req.headers.get(INTERNAL_AUTH_PROOF_HEADER))
    || Boolean(req.headers.get('x-user-id')) && !tenantHeader;

  if (presentedInternalHeaders) {
    if (!tenantHeader || !actorId) {
      return {
        ok: false,
        error: 'invalid_auth_context',
        status: 401,
        evidence: evidence('deny', 'internal_proof', 'invalid_auth_context'),
      };
    }

    if (await hasValidInternalAuthProof(req, tenantHeader, actorId)) {
      return {
        ok: true,
        tenant: { tenant_id: tenantHeader, auth_token: '' },
        actor_id: actorId,
        evidence: evidence('allow', 'internal_proof', 'signed_internal_context', { tenant_id: tenantHeader, actor_id: actorId, identity_source: 'signed_internal_context' }),
      };
    }

    return {
      ok: false,
      error: 'invalid_auth_context',
      status: 401,
      evidence: evidence('deny', 'internal_proof', 'invalid_auth_context'),
    };
  }

  if (
    process.env.REQUIEM_ROUTE_VERIFY_MODE === '1'
    && process.env.NODE_ENV === 'test'
    && tenantHeader
  ) {
    return {
      ok: true,
      tenant: { tenant_id: tenantHeader, auth_token: '' },
      actor_id: req.headers.get('x-user-id')?.trim() || tenantHeader,
      evidence: evidence('allow', 'route_verify', 'explicit_test_fixture', { tenant_id: tenantHeader, actor_id: req.headers.get('x-user-id')?.trim() || tenantHeader, identity_source: 'explicit_test_fixture' }),
    };
  }

  const auth = req.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return {
      ok: false,
      error: 'missing_auth',
      status: 401,
      evidence: evidence('deny', 'none', 'missing_auth'),
    };
  }

  const token = auth.slice(7);
  const secret = process.env.REQUIEM_AUTH_SECRET;
  const strict = isStrictAuthMode();

  if (!secret) {
    if (allowInsecureDevAuth()) {
      if (!tenantHeader) {
        return {
          ok: false,
          error: 'missing_tenant_id',
          status: 400,
          evidence: evidence('deny', 'local_dev', 'missing_tenant_id'),
        };
      }
      return {
        ok: true,
        tenant: { tenant_id: tenantHeader, auth_token: token },
        actor_id: tenantHeader,
        evidence: evidence('allow', 'local_dev', 'explicit_local_dev_opt_in', { tenant_id: tenantHeader, actor_id: tenantHeader, identity_source: 'explicit_test_fixture' }),
      };
    }

    return {
      ok: false,
      error: strict ? 'auth_secret_required' : 'missing_auth_secret',
      status: 503,
      evidence: evidence('deny', 'direct_bearer', strict ? 'auth_secret_required' : 'missing_auth_secret'),
    };
  }

  if (!isProductionLikeAuthRuntime() && token !== secret) {
    return {
      ok: false,
      error: 'invalid_auth',
      status: 401,
      evidence: evidence('deny', 'direct_bearer', 'invalid_auth'),
    };
  }

  if (isProductionLikeAuthRuntime() && !middlewareAuthenticated) {
    const identity = await verifyDirectBearerToken(token, secret);
    if (identity) {
      return {
        ok: true,
        tenant: { tenant_id: identity.tenant_id, auth_token: token },
        actor_id: identity.actor_id,
        evidence: evidence('allow', 'direct_bearer', 'token_identity_claims_valid', { tenant_id: identity.tenant_id, actor_id: identity.actor_id, identity_source: 'token_claims' }),
      };
    }
    return {
      ok: false,
      error: 'identity_claims_required',
      status: 401,
      evidence: evidence('deny', 'direct_bearer', 'identity_claims_required'),
    };
  }

  if (!tenantHeader) {
    return {
      ok: false,
      error: 'missing_tenant_id',
      status: 400,
      evidence: evidence('deny', 'test_fixture', 'missing_tenant_id'),
    };
  }

  return {
    ok: true,
    tenant: { tenant_id: tenantHeader, auth_token: token },
    actor_id: tenantHeader,
    evidence: evidence('allow', 'test_fixture', 'explicit_test_fixture', { tenant_id: tenantHeader, actor_id: tenantHeader, identity_source: 'explicit_test_fixture' }),
  };
}

function authErrorDetail(code: string): string {
  switch (code) {
    case 'missing_auth':
      return 'Missing bearer token';
    case 'invalid_auth':
      return 'Invalid bearer token';
    case 'missing_tenant_id':
      return 'Missing tenant context (x-tenant-id)';
    case 'auth_secret_required':
      return 'REQUIEM_AUTH_SECRET is required for strict auth mode';
    case 'missing_auth_secret':
      return 'REQUIEM_AUTH_SECRET is missing and insecure dev auth is disabled';
    case 'invalid_auth_context':
      return 'Invalid middleware authentication context';
    case 'identity_claims_required':
      return 'A signed server-side identity context is required';
    default:
      return code;
  }
}

export function authErrorResponse(
  result: AuthResult,
  traceId = 'auth-failure',
  requestId?: string,
): NextResponse {
  const status = result.status ?? 401;
  return problemResponse({
    status,
    title: status >= 500 ? 'Authentication Configuration Error' : 'Authentication Failed',
    detail: authErrorDetail(result.error ?? 'auth_failed'),
    code: result.error ?? 'auth_failed',
    traceId,
    requestId,
    errors: result.evidence ? [result.evidence] : undefined,
  });
}
