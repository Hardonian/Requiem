/**
 * @fileoverview Next.js transport adapter for MCP handlers.
 *
 * Wraps framework-agnostic MCP handlers as Next.js Route Handler functions.
 * Handles auth, tenant resolution, and structured error responses.
 *
 * INVARIANT: Tenant context is ALWAYS derived from auth header, NEVER from body.
 * INVARIANT: Every response uses the standard ApiEnvelope shape.
 */

import { handleListTools, handleCallTool, handleHealth } from './server.js';
import { AiError } from '../errors/AiError.js';
import { AiErrorCode } from '../errors/codes.js';
import { newId, now } from '../types/index.js';
import { TenantRole } from '../types/index.js';
import type { InvocationContext, TenantContext } from '../types/index.js';

// ─── Auth Resolution ──────────────────────────────────────────────────────────

/**
 * Resolve InvocationContext from a Next.js Request.
 * In production, validate JWT/session. In dev mode (if REQUIEM_DEV_MODE=1),
 * use a single-tenant stub with a loud warning.
 *
 * INVARIANT: tenant_id is NEVER read from request body or headers directly.
 */
async function resolveContext(req: Request): Promise<InvocationContext> {
  const traceId = newId('trace');
  const env = (process.env.NODE_ENV ?? 'development') as InvocationContext['environment'];

  // Dev mode single-tenant stub (explicit opt-in required)
  if (process.env.REQUIEM_DEV_MODE === '1') {
    console.warn(
      '[MCP] WARNING: REQUIEM_DEV_MODE=1 — using single-tenant dev stub. NOT for production.'
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
    };
  }

  // Production: validate auth header
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    throw new AiError({
      code: AiErrorCode.UNAUTHORIZED,
      message: 'Authorization header required',
      phase: 'auth',
    });
  }

  // TODO: Replace with real JWT validation against your auth provider.
  // The token should contain tenant_id, user_id, and role claims.
  // INVARIANT: tenant_id must come from validated token, not request body.
  throw new AiError({
    code: AiErrorCode.NOT_CONFIGURED,
    message:
      'Production auth not configured. Set REQUIEM_DEV_MODE=1 for local dev, or implement JWT validation.',
    phase: 'auth',
  });
}

// ─── Next.js Route Handlers ───────────────────────────────────────────────────

/** GET /api/mcp/health — no auth required */
export async function GET_health(_req: Request): Promise<Response> {
  const result = await handleHealth();
  return jsonResponse(result, result.ok ? 200 : 500);
}

/** GET /api/mcp/tools — auth required */
export async function GET_tools(req: Request): Promise<Response> {
  try {
    const ctx = await resolveContext(req);
    const result = await handleListTools(ctx);
    return jsonResponse(result, result.ok ? 200 : 500);
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/mcp/tool/call — auth required */
export async function POST_callTool(req: Request): Promise<Response> {
  try {
    const ctx = await resolveContext(req);

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

    const status = result.ok ? 200 : (result.error?.code === 'AI_POLICY_DENIED' ? 403 :
      result.error?.code === 'AI_TOOL_NOT_FOUND' ? 404 :
      result.error?.code?.includes('SCHEMA') ? 400 : 500);

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
  return jsonResponse(
    { ok: false, error: aiErr.toSafeJson() },
    aiErr.httpStatus()
  );
}
