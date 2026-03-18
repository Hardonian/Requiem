import { NextResponse, type NextRequest } from 'next/server';
import { z, type ZodTypeAny } from 'zod';
import { authErrorResponse, validateTenantAuth } from './auth';
import {
  ProblemError,
  problemResponse,
  requestIdFromHeaders,
  traceIdFromHeaders,
  unknownErrorToProblem,
} from './problem-json';

export interface RequestContext {
  tenant_id: string;
  actor_id: string;
  request_id: string;
  trace_id: string;
  auth_token: string;
  pathname: string;
  method: string;
}

export interface RateLimitOptions {
  capacity: number;
  refillPerSecond: number;
  cost: number;
}

export interface IdempotencyOptions {
  required?: boolean;
  ttlMs?: number;
}

export interface CacheOptions {
  ttlMs: number;
  staleWhileRevalidateMs?: number;
  visibility?: 'public' | 'private';
  key?: (req: NextRequest, ctx: RequestContext) => string;
}

export interface TenantRouteOptions {
  requireAuth?: boolean;
  routeId?: string;
  rateLimit?: false | Partial<RateLimitOptions>;
  idempotency?: false | IdempotencyOptions;
  cache?: false | CacheOptions;
}

type PolicyDecision = { allow: boolean; reasons: string[] };
type PolicyEval = (ctx: RequestContext) => Promise<PolicyDecision>;

type BucketState = {
  tokens: number;
  lastRefillMs: number;
};

type CachedResponse = {
  status: number;
  headers: Array<[string, string]>;
  bodyText: string;
  expiresAtMs: number;
};

type IdempotencyRecord = {
  requestHash: string;
  response: CachedResponse;
  expiresAtMs: number;
};

const rateBuckets = new Map<string, BucketState>();
const responseCache = new Map<string, CachedResponse>();
const idempotencyCache = new Map<string, IdempotencyRecord>();

const DEFAULT_RATE_LIMIT: RateLimitOptions = {
  capacity: 120,
  refillPerSecond: 2,
  cost: 1,
};

const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

const MEMORY_SCOPE_HEADER = 'memory-single-process';


function cleanupCaches(now: number): void {
  if (responseCache.size > 4096) {
    for (const [key, value] of responseCache.entries()) {
      if (value.expiresAtMs <= now) {
        responseCache.delete(key);
      }
    }
  }

  if (idempotencyCache.size > 4096) {
    for (const [key, value] of idempotencyCache.entries()) {
      if (value.expiresAtMs <= now) {
        idempotencyCache.delete(key);
      }
    }
  }
}

function resolveRateLimitOptions(options: false | Partial<RateLimitOptions> | undefined): RateLimitOptions | null {
  if (options === false) return null;
  return {
    capacity: options?.capacity ?? DEFAULT_RATE_LIMIT.capacity,
    refillPerSecond: options?.refillPerSecond ?? DEFAULT_RATE_LIMIT.refillPerSecond,
    cost: options?.cost ?? DEFAULT_RATE_LIMIT.cost,
  };
}

function consumeTokenBucket(key: string, options: RateLimitOptions): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const bucket = rateBuckets.get(key) ?? {
    tokens: options.capacity,
    lastRefillMs: now,
  };

  const elapsedSec = (now - bucket.lastRefillMs) / 1000;
  const refilled = Math.min(options.capacity, bucket.tokens + elapsedSec * options.refillPerSecond);
  const remaining = refilled - options.cost;

  if (remaining < 0) {
    const deficit = Math.abs(remaining);
    const retryAfterSec = Math.max(1, Math.ceil(deficit / options.refillPerSecond));
    rateBuckets.set(key, {
      tokens: refilled,
      lastRefillMs: now,
    });
    return { allowed: false, retryAfterSec };
  }

  rateBuckets.set(key, {
    tokens: remaining,
    lastRefillMs: now,
  });
  return { allowed: true, retryAfterSec: 0 };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((part) => part.toString(16).padStart(2, '0'))
    .join('');
}

async function toCachedResponse(response: Response, expiresAtMs: number): Promise<CachedResponse> {
  const clone = response.clone();
  const bodyText = await clone.text();
  return {
    status: response.status,
    headers: Array.from(response.headers.entries()),
    bodyText,
    expiresAtMs,
  };
}

function fromCachedResponse(snapshot: CachedResponse, headers: Record<string, string> | Headers = {}): Response {
  const merged = new Headers(snapshot.headers);
  const extra = new Headers(headers);
  for (const [key, value] of extra.entries()) {
    merged.set(key, value);
  }

  return new Response(snapshot.bodyText, {
    status: snapshot.status,
    headers: merged,
  });
}

function applyRuntimeScopeHeaders(
  response: Response,
  options: {
    rateLimitEnabled: boolean;
    idempotencyEnabled: boolean;
    cacheEnabled: boolean;
  },
): Response {
  if (options.rateLimitEnabled) {
    response.headers.set('x-requiem-rate-limit-scope', MEMORY_SCOPE_HEADER);
  }
  if (options.idempotencyEnabled) {
    response.headers.set('x-requiem-idempotency-scope', MEMORY_SCOPE_HEADER);
  }
  if (options.cacheEnabled) {
    response.headers.set('x-requiem-cache-scope', MEMORY_SCOPE_HEADER);
  }
  return response;
}

function computeCacheControl(cache: false | CacheOptions | undefined): string {
  if (!cache) {
    return 'no-store';
  }

  const visibility = cache.visibility ?? 'private';
  const maxAge = Math.max(0, Math.floor(cache.ttlMs / 1000));
  const swr = Math.max(0, Math.floor((cache.staleWhileRevalidateMs ?? 0) / 1000));
  if (swr > 0) {
    return `${visibility}, max-age=${maxAge}, stale-while-revalidate=${swr}`;
  }
  return `${visibility}, max-age=${maxAge}`;
}

function buildContext(
  req: NextRequest,
  tenantId: string,
  authToken: string,
  actorId?: string,
): RequestContext {
  return {
    tenant_id: tenantId,
    actor_id: actorId?.trim() || tenantId,
    request_id: requestIdFromHeaders(req.headers),
    trace_id: traceIdFromHeaders(req.headers),
    auth_token: authToken,
    pathname: req.nextUrl.pathname,
    method: req.method.toUpperCase(),
  };
}

function logStructured(event: string, fields: Record<string, unknown>): void {
  const payload = {
    event,
    ts: new Date().toISOString(),
    ...fields,
  };
  console.info(JSON.stringify(payload));
}

export function parseQueryWithSchema<TSchema extends ZodTypeAny>(
  req: NextRequest,
  schema: TSchema,
): z.infer<TSchema> {
  const queryObject = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = schema.safeParse(queryObject);
  if (!parsed.success) {
    throw new ProblemError(
      400,
      'Validation Failed',
      'Query validation failed',
      {
        code: 'validation_error',
        errors: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      },
    );
  }

  return parsed.data;
}

export async function parseJsonWithSchema<TSchema extends ZodTypeAny>(
  req: NextRequest,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ProblemError(400, 'Invalid JSON', 'Request body must be valid JSON', {
      code: 'invalid_json',
    });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ProblemError(
      400,
      'Validation Failed',
      'Body validation failed',
      {
        code: 'validation_error',
        errors: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      },
    );
  }

  return parsed.data;
}

export async function withTenantContext(
  req: NextRequest,
  handler: (ctx: RequestContext) => Promise<Response>,
  policyEval: PolicyEval = async () => ({ allow: true, reasons: [] }),
  options: TenantRouteOptions = {},
): Promise<Response> {
  const now = Date.now();
  cleanupCaches(now);

  const requireAuth = options.requireAuth ?? true;
  const auth = requireAuth ? await validateTenantAuth(req) : { ok: true };

  const tenantId = requireAuth
    ? auth.tenant?.tenant_id ?? req.headers.get('x-tenant-id') ?? 'unknown'
    : 'public';
  const authToken = auth.tenant?.auth_token ?? '';
  const actorId = requireAuth ? auth.actor_id ?? auth.tenant?.tenant_id ?? tenantId : 'public';

  const ctx = buildContext(req, tenantId, authToken, actorId);
  const routeId = options.routeId ?? ctx.pathname;
  const startedAtMs = Date.now();

  if (requireAuth && (!auth.ok || !auth.tenant)) {
    const response = authErrorResponse(auth, ctx.trace_id, ctx.request_id);
    logStructured('api.request.denied', {
      route: routeId,
      method: ctx.method,
      status: response.status,
      trace_id: ctx.trace_id,
      request_id: ctx.request_id,
      tenant_id: ctx.tenant_id,
      reason: auth.error ?? 'auth_failed',
    });
    return response;
  }

  const rateLimit = resolveRateLimitOptions(options.rateLimit);
  if (rateLimit) {
    const key = `${ctx.tenant_id}:${ctx.actor_id}:${routeId}`;
    const consumed = consumeTokenBucket(key, rateLimit);
    if (!consumed.allowed) {
      return applyRuntimeScopeHeaders(problemResponse({
        status: 429,
        title: 'Too Many Requests',
        detail: 'Rate limit exceeded',
        code: 'rate_limited',
        traceId: ctx.trace_id,
        requestId: ctx.request_id,
        retryAfterSec: consumed.retryAfterSec,
      }), {
        rateLimitEnabled: true,
        idempotencyEnabled: false,
        cacheEnabled: false,
      });
    }
  }

  const cacheOptions = req.method.toUpperCase() === 'GET' ? options.cache : false;
  if (cacheOptions) {
    const cacheKey = cacheOptions.key
      ? cacheOptions.key(req, ctx)
      : `${ctx.tenant_id}:${req.method}:${req.nextUrl.pathname}?${req.nextUrl.searchParams.toString()}`;

    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAtMs > now) {
      const response = fromCachedResponse(cached, {
        'x-cache-hit': '1',
        'x-trace-id': ctx.trace_id,
        'x-request-id': ctx.request_id,
      });
      response.headers.set('cache-control', computeCacheControl(cacheOptions));
      return response;
    }
  }

  const idempotencyOptions =
    req.method.toUpperCase() === 'POST' || req.method.toUpperCase() === 'PUT' ? options.idempotency : false;

  let idempotencyKeyScope: string | null = null;
  let idempotencyRequestHash: string | null = null;
  if (idempotencyOptions) {
    const key = req.headers.get('idempotency-key');

    if (!key && idempotencyOptions.required) {
      return problemResponse({
        status: 400,
        title: 'Missing Idempotency Key',
        detail: 'Idempotency-Key header is required for this route',
        code: 'missing_idempotency_key',
        traceId: ctx.trace_id,
        requestId: ctx.request_id,
      });
    }

    if (key) {
      const rawBody = await req.clone().text();
      idempotencyRequestHash = await sha256Hex(
        `${ctx.tenant_id}:${req.method}:${req.nextUrl.pathname}:${rawBody}`,
      );
      idempotencyKeyScope = `${ctx.tenant_id}:${req.method}:${req.nextUrl.pathname}:${key}`;

      const existing = idempotencyCache.get(idempotencyKeyScope);
      if (existing && existing.expiresAtMs > now) {
        if (existing.requestHash !== idempotencyRequestHash) {
          return problemResponse({
            status: 409,
            title: 'Idempotency Conflict',
            detail: 'Idempotency-Key was reused with a different request body',
            code: 'idempotency_conflict',
            traceId: ctx.trace_id,
            requestId: ctx.request_id,
          });
        }

        const replayed = fromCachedResponse(existing.response, {
          'x-idempotency-replayed': '1',
          'x-trace-id': ctx.trace_id,
          'x-request-id': ctx.request_id,
        });
        replayed.headers.set('cache-control', 'no-store');
        return applyRuntimeScopeHeaders(replayed, {
          rateLimitEnabled: Boolean(rateLimit),
          idempotencyEnabled: true,
          cacheEnabled: Boolean(cacheOptions),
        });
      }
    }
  }

  try {
    const policy = await policyEval(ctx);
    if (!policy.allow) {
      return problemResponse({
        status: 403,
        title: 'Policy Denied',
        detail: policy.reasons.join('; ') || 'Denied',
        code: 'policy_denied',
        traceId: ctx.trace_id,
        requestId: ctx.request_id,
      });
    }

    const response = await handler(ctx);

    response.headers.set('x-trace-id', ctx.trace_id);
    response.headers.set('x-request-id', ctx.request_id);
    response.headers.set('cache-control', computeCacheControl(cacheOptions));

    if (cacheOptions && response.status < 400) {
      const cacheKey = cacheOptions.key
        ? cacheOptions.key(req, ctx)
        : `${ctx.tenant_id}:${req.method}:${req.nextUrl.pathname}?${req.nextUrl.searchParams.toString()}`;
      responseCache.set(
        cacheKey,
        await toCachedResponse(response, now + Math.max(1, cacheOptions.ttlMs)),
      );
    }

    if (idempotencyKeyScope && idempotencyRequestHash && response.status < 500) {
      const ttlMs = idempotencyOptions && typeof idempotencyOptions === 'object'
        ? idempotencyOptions.ttlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS
        : DEFAULT_IDEMPOTENCY_TTL_MS;
      idempotencyCache.set(idempotencyKeyScope, {
        requestHash: idempotencyRequestHash,
        response: await toCachedResponse(response, now + ttlMs),
        expiresAtMs: now + ttlMs,
      });
    }

    logStructured('api.request.completed', {
      route: routeId,
      method: ctx.method,
      status: response.status,
      trace_id: ctx.trace_id,
      request_id: ctx.request_id,
      tenant_id: ctx.tenant_id,
      actor_id: ctx.actor_id,
      duration_ms: Date.now() - startedAtMs,
    });

    return applyRuntimeScopeHeaders(response, {
      rateLimitEnabled: Boolean(rateLimit),
      idempotencyEnabled: Boolean(idempotencyOptions),
      cacheEnabled: Boolean(cacheOptions),
    });
  } catch (error) {
    const response = unknownErrorToProblem(error, ctx.trace_id, ctx.request_id);
    logStructured('api.request.failed', {
      route: routeId,
      method: ctx.method,
      status: response.status,
      trace_id: ctx.trace_id,
      request_id: ctx.request_id,
      tenant_id: ctx.tenant_id,
      actor_id: ctx.actor_id,
      duration_ms: Date.now() - startedAtMs,
      error_name: error instanceof Error ? error.name : 'unknown',
    });
    return applyRuntimeScopeHeaders(response, {
      rateLimitEnabled: Boolean(rateLimit),
      idempotencyEnabled: Boolean(idempotencyOptions),
      cacheEnabled: Boolean(cacheOptions),
    });
  }
}

export function jsonResponse(
  payload: unknown,
  ctx: Pick<RequestContext, 'trace_id' | 'request_id'>,
  status = 200,
  headers?: Record<string, string> | Headers,
): NextResponse {
  const response = NextResponse.json(payload, {
    status,
    headers,
  });
  response.headers.set('x-trace-id', ctx.trace_id);
  response.headers.set('x-request-id', ctx.request_id);
  return response;
}
