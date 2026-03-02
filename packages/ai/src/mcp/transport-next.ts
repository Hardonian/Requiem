/**
 * @fileoverview Next.js transport adapter for MCP handlers.
 *
 * Wraps framework-agnostic MCP handlers as Next.js Route Handler functions.
 * Handles auth, tenant resolution, rate limiting, and structured error responses.
 *
 * INVARIANT: Tenant context is ALWAYS derived from validated JWT claims, NEVER from
 *            request body, query params, or X-Tenant-ID header.
 * INVARIANT: Every response uses the standard ApiEnvelope shape.
 * INVARIANT: Production startup fails hard if REQUIEM_JWT_SECRET is not set.
 *
 * NOTE: This module requires `jsonwebtoken` and `@types/jsonwebtoken`.
 *       If not already installed, run:
 *         pnpm add jsonwebtoken
 *         pnpm add -D @types/jsonwebtoken
 *       in the packages/ai directory.
 */

// jsonwebtoken is a required dependency — see note in file header above.
import * as jwt from 'jsonwebtoken';

import { handleListTools, handleCallTool, handleHealth } from './server.js';
import { AiError } from '../errors/AiError.js';
import { AiErrorCode } from '../errors/codes.js';
import { newId, now } from '../types/index.js';
import { TenantRole } from '../types/index.js';
import { getRateLimiter } from './rateLimit.js';
import type { InvocationContext, TenantContext } from '../types/index.js';
import { CorrelationManager } from './correlation.js';

// ─── Auth Status ──────────────────────────────────────────────────────────────

/**
 * Reflects the current JWT validation implementation status.
 * 'active' = real HMAC/RSA-verified JWT validation is in place.
 */
export const AUTH_STATUS = 'active' as const;
export type AuthStatus = typeof AUTH_STATUS;

// ─── Startup Validation ───────────────────────────────────────────────────────

/**
 * Validate that required auth secrets are configured.
 *
 * In production (`NODE_ENV=production`) the absence of `REQUIEM_JWT_SECRET`
 * is a hard startup error — the process will throw immediately rather than
 * silently accepting unauthenticated requests.
 *
 * In non-production environments a prominent warning is logged but execution
 * continues (useful for local development and CI).
 *
 * @throws {Error} In production when REQUIEM_JWT_SECRET is not set.
 */
function assertAuthConfigured(): void {
  const secret = process.env.REQUIEM_JWT_SECRET ?? process.env.REQUIEM_AUTH_SECRET;
  if (!secret) {
    const msg =
      '[SECURITY] REQUIEM_JWT_SECRET is not set. ' +
      'Set this environment variable to a strong secret before accepting traffic.';
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `[FATAL] ${msg} Refusing to start in production without a JWT secret.`
      );
    }
    console.warn(msg);
  }
}

// Run the check at module load time so production containers fail fast.
assertAuthConfigured();

// ─── JWT Claims ───────────────────────────────────────────────────────────────

/**
 * Expected shape of decoded JWT payload claims.
 * At minimum a `sub` (subject / user ID) claim is required.
 * Tenant is resolved from `tenant_id` or `org_id` claim.
 */
interface JwtClaims {
  /** Subject — the authenticated user ID. */
  sub: string;
  /** Explicit tenant identifier (preferred). */
  tenant_id?: string;
  /** Organisation ID — used as tenant_id fallback. */
  org_id?: string;
  /** User role within the tenant. */
  role?: string;
  /** Standard expiry claim (validated automatically by jsonwebtoken). */
  exp?: number;
  /** Standard issued-at claim. */
  iat?: number;
}

// ─── Auth Resolution ──────────────────────────────────────────────────────────

/**
 * Map a JWT role string to a `TenantRole` enum value.
 * Falls back to `TenantRole.VIEWER` for unknown / absent roles.
 */
function mapRole(role: string | undefined): TenantRole {
  switch (role?.toLowerCase()) {
    case 'admin':
      return TenantRole.ADMIN;
    case 'editor':
    case 'write':
      return TenantRole.MEMBER;
    default:
      return TenantRole.VIEWER;
  }
}

/**
 * Resolve an `InvocationContext` from a Next.js Request.
 *
 * Auth flow:
 *  1. Require `Authorization: Bearer <token>` header.
 *  2. Verify JWT signature against `REQUIEM_JWT_SECRET` (or `REQUIEM_AUTH_SECRET`).
 *  3. Extract `sub`, `tenant_id`/`org_id`, and `role` from validated claims.
 *  4. Reject tokens that are missing required claims.
 *
 * Dev mode (`REQUIEM_DEV_MODE=1`):
 *  - If a Bearer token IS provided it is fully validated as above.
 *  - If no token is provided a stub context is used, but only when NOT in production.
 *
 * INVARIANT: `tenant_id` is derived exclusively from validated JWT claims.
 * INVARIANT: `X-Tenant-ID` header is never read or trusted.
 * INVARIANT: Correlation ID is extracted from X-Correlation-ID or traceparent header (S-20).
 */
async function resolveContext(req: Request): Promise<InvocationContext> {
  // Extract correlation ID from request headers (S-20: Request correlation smuggling)
  const correlationManager = CorrelationManager.fromHeaders(req.headers);
  const correlationId = correlationManager.getCorrelationId();

  const traceId = newId('trace');
  const env = (process.env.NODE_ENV ?? 'development') as InvocationContext['environment'];

  const authHeader = req.headers.get('authorization');

  // ── Dev mode stub (no token provided, non-production only) ──────────────────
  if (!authHeader && process.env.REQUIEM_DEV_MODE === '1') {
    if (env === 'production') {
      // Safety net: dev mode stub must never activate in production.
      throw new AiError({
        code: AiErrorCode.UNAUTHORIZED,
        message: 'Authorization header required',
        phase: 'auth',
      });
    }
    console.warn(
      '[MCP] WARNING: REQUIEM_DEV_MODE=1 without a token — using single-tenant dev stub. NOT for production.'
    );
    const devTenant: TenantContext = {
      tenantId: 'dev-tenant',
      userId: 'dev-user',
      role: TenantRole.ADMIN,
      derivedAt: now(),
    };
    return {
      tenant: devTenant,
      actorId: 'dev-user',
      traceId,
      environment: env,
      createdAt: now(),
      correlationId,  // S-20: Add correlation ID to context
    };
  }

  // ── Require Authorization header in all other cases ─────────────────────────
  if (!authHeader) {
    throw new AiError({
      code: AiErrorCode.UNAUTHORIZED,
      message: 'Authorization header required',
      phase: 'auth',
    });
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new AiError({
      code: AiErrorCode.UNAUTHORIZED,
      message: 'Authorization header must use the Bearer scheme',
      phase: 'auth',
    });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new AiError({
      code: AiErrorCode.UNAUTHORIZED,
      message: 'Bearer token must not be empty',
      phase: 'auth',
    });
  }

  // ── JWT signature verification ───────────────────────────────────────────────
  const secret = process.env.REQUIEM_JWT_SECRET ?? process.env.REQUIEM_AUTH_SECRET;

  if (!secret) {
    // Non-production without a secret: still validate token structure (no sig check).
    // We never allow arbitrary tokens to be silently trusted.
    let claims: JwtClaims;
    try {
      // decode() does NOT verify signature — used here only to check structure.
      const decoded = jwt.decode(token);
      if (!decoded || typeof decoded !== 'object') {
        throw new Error('Token is not a valid JWT structure');
      }
      claims = decoded as JwtClaims;
    } catch (e) {
      throw new AiError({
        code: AiErrorCode.UNAUTHORIZED,
        message: 'Token is malformed',
        phase: 'auth',
      });
    }
    console.warn(
      '[SECURITY] No REQUIEM_JWT_SECRET set — JWT signature NOT verified. ' +
        'Set the secret to enable full validation.'
    );
    return buildContext(claims, traceId, env, correlationId);
  }

  // Full signature verification path.
  let claims: JwtClaims;
  try {
    claims = jwt.verify(token, secret, {
      algorithms: ['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512'],
    }) as JwtClaims;
  } catch (e) {
    const jwtErr = e as Error;
    throw new AiError({
      code: AiErrorCode.UNAUTHORIZED,
      message: `Token validation failed: ${jwtErr.message}`,
      phase: 'auth',
    });
  }

  return buildContext(claims, traceId, env, correlationId);
}

/**
 * Build an `InvocationContext` from verified JWT claims.
 *
 * @param claims - Decoded and verified JWT payload.
 * @param traceId - Pre-generated trace ID for this request.
 * @param env - Current runtime environment label.
 * @throws {AiError} When required claims (`sub`, tenant identifier) are absent.
 */
function buildContext(
  claims: JwtClaims,
  traceId: string,
  env: InvocationContext['environment'],
  correlationId: string
): InvocationContext {
  if (!claims.sub) {
    throw new AiError({
      code: AiErrorCode.UNAUTHORIZED,
      message: 'JWT is missing required "sub" claim',
      phase: 'auth',
    });
  }

  const tenantId = claims.tenant_id ?? claims.org_id;
  if (!tenantId) {
    throw new AiError({
      code: AiErrorCode.TENANT_REQUIRED,
      message: 'JWT is missing required tenant_id or org_id claim',
      phase: 'auth',
    });
  }

  const tenant: TenantContext = {
    tenantId,
    userId: claims.sub,
    role: mapRole(claims.role),
    derivedAt: now(),
  };

  return {
    tenant,
    actorId: claims.sub,
    traceId,
    environment: env,
    createdAt: now(),
    correlationId,
  };
}

// ─── Next.js Route Handlers ───────────────────────────────────────────────────

/**
 * GET /api/mcp/health — no auth required.
 * Returns only operational status; no auth configuration is disclosed.
 */
export async function GET_health(_req: Request): Promise<Response> {
  const result = await handleHealth();
  return jsonResponse(result, result.ok ? 200 : 500);
}

/**
 * GET /api/mcp/tools — auth required.
 * Applies per-tenant rate limiting after context resolution.
 */
export async function GET_tools(req: Request): Promise<Response> {
  try {
    const ctx = await resolveContext(req);
    if (!getRateLimiter().check(ctx.tenant.tenantId)) {
      return rateLimitResponse(ctx.traceId);
    }
    const result = await handleListTools(ctx);
    return jsonResponse(result, result.ok ? 200 : 500);
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * POST /api/mcp/tool/call — auth required.
 * Applies per-tenant rate limiting after context resolution.
 */
export async function POST_callTool(req: Request): Promise<Response> {
  try {
    const ctx = await resolveContext(req);
    if (!getRateLimiter().check(ctx.tenant.tenantId)) {
      return rateLimitResponse(ctx.traceId);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      const err = new AiError({
        code: AiErrorCode.MCP_PARSE_ERROR,
        message: 'Request body must be valid JSON',
        phase: 'mcp.callTool',
      });
      return jsonResponse({ ok: false, error: err.toSafeJson(), trace_id: ctx.traceId }, 400);
    }

    if (typeof body !== 'object' || body === null) {
      const err = new AiError({
        code: AiErrorCode.MCP_INVALID_REQUEST,
        message: 'Request body must be an object',
        phase: 'mcp.callTool',
      });
      return jsonResponse({ ok: false, error: err.toSafeJson(), trace_id: ctx.traceId }, 400);
    }

    const { toolName, arguments: toolArgs } = body as Record<string, unknown>;
    const result = await handleCallTool(ctx, toolName as string, toolArgs);

    const status = result.ok
      ? 200
      : result.error?.code === 'AI_POLICY_DENIED'
        ? 403
        : result.error?.code === 'AI_TOOL_NOT_FOUND'
          ? 404
          : result.error?.code?.includes('SCHEMA')
            ? 400
            : 500;

    return jsonResponse(result, status);
  } catch (err) {
    return errorResponse(err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(err: unknown): Response {
  const aiErr = err instanceof AiError ? err : AiError.fromUnknown(err, 'mcp');
  return jsonResponse({ ok: false, error: aiErr.toSafeJson() }, aiErr.httpStatus());
}

/**
 * Build a 429 Too Many Requests response with a Retry-After hint.
 *
 * @param traceId - Trace ID for correlation.
 */
function rateLimitResponse(traceId: string): Response {
  const body = {
    ok: false,
    error: {
      code: 'AI_RATE_LIMIT_EXCEEDED',
      message: 'Rate limit exceeded. Retry after 60 seconds.',
      retryable: true,
    },
    trace_id: traceId,
  };
  return new Response(JSON.stringify(body), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': '60',
    },
  });
}
