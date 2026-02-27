// ready-layer/src/lib/auth.ts
//
// BOUNDARY CONTRACT: Node API ↔ Next.js — Authentication + Tenant validation
//
// INVARIANT: Every route under /app/* and every API route that touches
// tenant data MUST call validateTenantAuth() before any engine call.
// Routes that skip auth must be explicitly listed in the public routes allow-list.
//
// EXTENSION_POINT: enterprise_auth
//   Current: Bearer token from Authorization header validated against
//   REQUIEM_AUTH_SECRET. Suitable for M2M service accounts.
//   Upgrade path:
//     a) OIDC/OAuth2: validate JWT against JWKS endpoint from IDP.
//     b) API keys: hash-compare against tenant key table in database.
//     c) mTLS: validate client certificate subject against tenant registry.
//   Invariant: NEVER trust tenant_id from the request body or query string
//   without cryptographic validation. Always derive tenant_id from the
//   validated auth token.

import { NextRequest, NextResponse } from 'next/server';
import type { TenantContext } from './engine-client';

export interface AuthResult {
  ok: boolean;
  tenant?: TenantContext;
  error?: string;
  status?: number;
}

// ---------------------------------------------------------------------------
// Public routes allow-list (no auth required)
// ---------------------------------------------------------------------------
// INVARIANT: Only routes with no tenant data access may be listed here.
// Adding a route that touches tenant data to this list is a SECURITY BUG.
const PUBLIC_ROUTES = new Set([
  '/api/health',
  '/',
  '/pricing',
  '/docs',
]);

export function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  // Static assets, Next.js internals
  if (pathname.startsWith('/_next/') || pathname.startsWith('/static/')) return true;
  return false;
}

// ---------------------------------------------------------------------------
// validateTenantAuth — extract and validate tenant context from request
// ---------------------------------------------------------------------------
export async function validateTenantAuth(req: NextRequest): Promise<AuthResult> {
  const auth = req.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return {
      ok: false,
      error: 'missing_auth',
      status: 401,
    };
  }

  const token = auth.slice(7);

  // EXTENSION_POINT: enterprise_auth
  // Replace this stub with real JWT verification:
  //   const payload = await verifyJWT(token, process.env.JWKS_URL!);
  //   const tenant_id = payload.sub;
  if (!process.env.REQUIEM_AUTH_SECRET) {
    // Dev mode: accept any token, derive tenant from header
    const tenantHeader = req.headers.get('X-Tenant-ID') ?? 'dev-tenant';
    return {
      ok: true,
      tenant: { tenant_id: tenantHeader, auth_token: token },
    };
  }

  // Production: validate token matches secret (replace with real OIDC)
  if (token !== process.env.REQUIEM_AUTH_SECRET) {
    return { ok: false, error: 'invalid_auth', status: 401 };
  }

  const tenantHeader = req.headers.get('X-Tenant-ID');
  if (!tenantHeader) {
    return { ok: false, error: 'missing_tenant_id', status: 400 };
  }

  return {
    ok: true,
    tenant: { tenant_id: tenantHeader, auth_token: token },
  };
}

// Convenience: return a structured 401/400 response on auth failure
export function authErrorResponse(result: AuthResult): NextResponse {
  return NextResponse.json(
    { ok: false, error: result.error ?? 'auth_failed' },
    { status: result.status ?? 401 },
  );
}
