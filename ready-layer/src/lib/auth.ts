// ready-layer/src/lib/auth.ts
//
// BOUNDARY CONTRACT: Node API <-> Next.js - Authentication + Tenant validation

import { NextRequest, NextResponse } from 'next/server';
import type { TenantContext } from './engine-client';
import { problemResponse } from './problem-json';

export interface AuthResult {
  ok: boolean;
  tenant?: TenantContext;
  error?: string;
  status?: number;
}

const PUBLIC_ROUTES = new Set([
  '/api/health',
  '/api/openapi.json',
  '/',
  '/pricing',
  '/docs',
]);

export function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  if (pathname.startsWith('/_next/') || pathname.startsWith('/static/')) return true;
  return false;
}

function resolveTenantId(req: NextRequest): string | null {
  return req.headers.get('x-tenant-id') ?? req.headers.get('x-user-id');
}

export async function validateTenantAuth(req: NextRequest): Promise<AuthResult> {
  const tenantHeader = resolveTenantId(req);
  const middlewareAuthenticated = req.headers.get('x-requiem-authenticated') === '1';

  if (
    middlewareAuthenticated
    && tenantHeader
  ) {
    return {
      ok: true,
      tenant: { tenant_id: tenantHeader, auth_token: '' },
    };
  }

  if (
    process.env.REQUIEM_ROUTE_VERIFY_MODE === '1'
    && process.env.NODE_ENV !== 'production'
    && tenantHeader
  ) {
    return {
      ok: true,
      tenant: { tenant_id: tenantHeader, auth_token: '' },
    };
  }

  const auth = req.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return {
      ok: false,
      error: 'missing_auth',
      status: 401,
    };
  }

  const token = auth.slice(7);

  if (!process.env.REQUIEM_AUTH_SECRET) {
    return {
      ok: true,
      tenant: { tenant_id: tenantHeader ?? 'dev-tenant', auth_token: token },
    };
  }

  if (token !== process.env.REQUIEM_AUTH_SECRET) {
    return {
      ok: false,
      error: 'invalid_auth',
      status: 401,
    };
  }

  if (!tenantHeader) {
    return {
      ok: false,
      error: 'missing_tenant_id',
      status: 400,
    };
  }

  return {
    ok: true,
    tenant: { tenant_id: tenantHeader, auth_token: token },
  };
}

function authErrorDetail(code: string): string {
  switch (code) {
    case 'missing_auth':
      return 'Missing bearer token';
    case 'invalid_auth':
      return 'Invalid bearer token';
    case 'missing_tenant_id':
      return 'Missing tenant context';
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
    title: 'Authentication Failed',
    detail: authErrorDetail(result.error ?? 'auth_failed'),
    code: result.error ?? 'auth_failed',
    traceId,
    requestId,
  });
}
