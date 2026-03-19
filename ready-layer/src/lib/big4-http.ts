import { NextResponse, type NextRequest } from 'next/server';
import { z, type ZodTypeAny } from 'zod';
import { authErrorResponse, validateTenantAuth } from './auth';
import {
  REQUEST_EXECUTION_MODEL,
  currentDeploymentTopology,
} from './deployment-contract';
import { logStructured, withObservabilityContext } from './observability';
import {
  ProblemError,
  problemResponse,
  requestIdFromHeaders,
  traceIdFromHeaders,
  unknownErrorToProblem,
} from './problem-json';
import { isProductionLikeRuntime } from './runtime-mode';
import {
  claimDurableIdempotency,
  consumeDurableRateLimit,
  ensureSharedCoordinationAvailable,
  persistDurableIdempotencyResponse,
  type SharedCoordinationScope,
} from './shared-request-coordination';

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
const MEMORY_SCOPE_HEADER = 'memory-single-process' as const;

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

function consumeMemoryTokenBucket(key: string, options: RateLimitOptions): { allowed: boolean; retryAfterSec: number } {
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

function fromCachedResponse(snapshot: Pick<CachedResponse, 'status' | 'headers' | 'bodyText'>, headers: Record<string, string> | Headers = {}): Response {
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
    rateLimitScope?: SharedCoordinationScope | null;
    idempotencyScope?: SharedCoordinationScope | null;
    cacheScope?: SharedCoordinationScope | null;
    idempotencyState?: 'started' | 'replayed' | 'in_progress' | 'recovery_required' | null;
    topology?: string;
  },
): Response {
  if (options.rateLimitScope) {
    response.headers.set('x-requiem-rate-limit-scope', options.rateLimitScope);
  }
  if (options.idempotencyScope) {
    response.headers.set('x-requiem-idempotency-scope', options.idempotencyScope);
  }
  if (options.cacheScope) {
    response.headers.set('x-requiem-cache-scope', options.cacheScope);
  }
  if (options.idempotencyState) {
    response.headers.set('x-requiem-idempotency-state', options.idempotencyState);
  }
  response.headers.set('x-requiem-execution-model', REQUEST_EXECUTION_MODEL);
  if (options.topology) {
    response.headers.set('x-requiem-supported-topology', options.topology);
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

function cacheKeyForRequest(req: NextRequest, ctx: RequestContext, cacheOptions: CacheOptions): string {
  return cacheOptions.key
    ? cacheOptions.key(req, ctx)
    : `${ctx.tenant_id}:${req.method}:${req.nextUrl.pathname}?${req.nextUrl.searchParams.toString()}`;
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
  const productionLike = isProductionLikeRuntime();
  const topology = currentDeploymentTopology(productionLike);

  let rateLimitScope: SharedCoordinationScope | null = null;
  const cacheOptions = req.method === 'GET' && !productionLike ? options.cache : false;
  const cacheScope: SharedCoordinationScope | null = cacheOptions ? MEMORY_SCOPE_HEADER : null;
  let idempotencyScope: SharedCoordinationScope | null = null;
  let idempotencyKeyScope: string | null = null;
  let idempotencyRequestHash: string | null = null;
  let idempotencyTtlMs = DEFAULT_IDEMPOTENCY_TTL_MS;
  let idempotencyState: 'started' | 'replayed' | 'in_progress' | 'recovery_required' | null = null;

  logStructured('info', 'api.request.received', {
    route_id: routeId,
    method: ctx.method,
    pathname: ctx.pathname,
    trace_id: ctx.trace_id,
    request_id: ctx.request_id,
    tenant_id: ctx.tenant_id,
    actor_id: ctx.actor_id,
    execution_model: REQUEST_EXECUTION_MODEL,
    supported_topology: topology,
    has_idempotency_key: Boolean(req.headers.get('idempotency-key')),
  });

  if (requireAuth && auth.ok && auth.tenant) {
    logStructured('info', 'api.auth.succeeded', {
      route_id: routeId,
      method: ctx.method,
      trace_id: ctx.trace_id,
      request_id: ctx.request_id,
      tenant_id: ctx.tenant_id,
      actor_id: ctx.actor_id,
    });
  }

  if (requireAuth && (!auth.ok || !auth.tenant)) {
    return applyRuntimeScopeHeaders(authErrorResponse(auth, ctx.trace_id, ctx.request_id), {
      rateLimitScope,
      idempotencyScope,
      cacheScope,
      topology,
    });
  }

  try {
    const rateLimit = resolveRateLimitOptions(options.rateLimit);
    if (rateLimit) {
      const key = `${ctx.tenant_id}:${ctx.actor_id}:${routeId}`;
      const consumed = productionLike
        ? await (async () => {
          ensureSharedCoordinationAvailable('rate_limit');
          const durable = await consumeDurableRateLimit(key, rateLimit);
          if (!durable) {
            throw new ProblemError(503, 'Setup Required', 'Shared rate limiting is required in production-like deployments.', {
              code: 'shared_runtime_coordination_unconfigured',
            });
          }
          rateLimitScope = durable.scope;
          return durable;
        })()
        : (() => {
          rateLimitScope = MEMORY_SCOPE_HEADER;
          const local = consumeMemoryTokenBucket(key, rateLimit);
          return { ...local, scope: MEMORY_SCOPE_HEADER };
        })();

      if (!consumed.allowed) {
        logStructured('warn', 'api.rate_limit.exceeded', {
          route_id: routeId,
          method: ctx.method,
          trace_id: ctx.trace_id,
          request_id: ctx.request_id,
          tenant_id: ctx.tenant_id,
          actor_id: ctx.actor_id,
          retry_after_sec: consumed.retryAfterSec,
        });
        return applyRuntimeScopeHeaders(problemResponse({
          status: 429,
          title: 'Too Many Requests',
          detail: 'Rate limit exceeded',
          code: 'rate_limited',
          traceId: ctx.trace_id,
          requestId: ctx.request_id,
          retryAfterSec: consumed.retryAfterSec,
        }), {
          rateLimitScope,
          idempotencyScope,
          cacheScope,
          topology,
        });
      }
    }

    if (cacheOptions) {
      const cacheKey = cacheKeyForRequest(req, ctx, cacheOptions);
      const cached = responseCache.get(cacheKey);
      if (cached && cached.expiresAtMs > now) {
        const response = fromCachedResponse(cached, {
          'x-cache-hit': '1',
          'x-trace-id': ctx.trace_id,
          'x-request-id': ctx.request_id,
        });
        response.headers.set('cache-control', computeCacheControl(cacheOptions));
        logStructured('info', 'api.cache.hit', {
          route_id: routeId,
          method: ctx.method,
          trace_id: ctx.trace_id,
          request_id: ctx.request_id,
          tenant_id: ctx.tenant_id,
          actor_id: ctx.actor_id,
        });
        return applyRuntimeScopeHeaders(response, {
          rateLimitScope,
          idempotencyScope,
          cacheScope,
          topology,
        });
      }
    }

    const idempotencyOptions =
      req.method === 'POST' || req.method === 'PUT' ? options.idempotency : false;

    if (idempotencyOptions) {
      const key = req.headers.get('idempotency-key');

      if (!key && idempotencyOptions.required) {
        logStructured('warn', 'api.idempotency.missing_key', {
          route_id: routeId,
          method: ctx.method,
          trace_id: ctx.trace_id,
          request_id: ctx.request_id,
          tenant_id: ctx.tenant_id,
          actor_id: ctx.actor_id,
        });
        return applyRuntimeScopeHeaders(problemResponse({
          status: 400,
          title: 'Missing Idempotency Key',
          detail: 'Idempotency-Key header is required for this route',
          code: 'missing_idempotency_key',
          traceId: ctx.trace_id,
          requestId: ctx.request_id,
        }), {
          rateLimitScope,
          idempotencyScope,
          cacheScope,
          topology,
        });
      }

      if (key) {
        idempotencyTtlMs = typeof idempotencyOptions === 'object'
          ? idempotencyOptions.ttlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS
          : DEFAULT_IDEMPOTENCY_TTL_MS;
        const rawBody = await req.clone().text();
        idempotencyRequestHash = await sha256Hex(
          `${ctx.tenant_id}:${req.method}:${req.nextUrl.pathname}:${rawBody}`,
        );
        idempotencyKeyScope = `${ctx.tenant_id}:${req.method}:${req.nextUrl.pathname}:${key}`;

        if (productionLike) {
          ensureSharedCoordinationAvailable('idempotency');
          const claim = await claimDurableIdempotency(
            idempotencyKeyScope,
            idempotencyRequestHash,
            idempotencyTtlMs,
          );
          if (!claim) {
            throw new ProblemError(503, 'Setup Required', 'Durable idempotency protection is required in production-like deployments.', {
              code: 'shared_runtime_coordination_unconfigured',
            });
          }
          idempotencyScope = claim.scope;

          if (claim.kind === 'conflict') {
            return applyRuntimeScopeHeaders(problemResponse({
              status: 409,
              title: 'Idempotency Conflict',
              detail: 'Idempotency-Key was reused with a different request body',
              code: 'idempotency_conflict',
              traceId: ctx.trace_id,
              requestId: ctx.request_id,
            }), {
              rateLimitScope,
              idempotencyScope,
              cacheScope,
              topology,
            });
          }

          if (claim.kind === 'replay') {
            logStructured('info', 'api.idempotency.replay', {
              route_id: routeId,
              method: ctx.method,
              trace_id: ctx.trace_id,
              request_id: ctx.request_id,
              tenant_id: ctx.tenant_id,
              actor_id: ctx.actor_id,
              idempotency_key: key,
            });
            idempotencyState = 'replayed';
            return applyRuntimeScopeHeaders(fromCachedResponse(claim.response, {
              'x-idempotency-replayed': '1',
              'x-trace-id': ctx.trace_id,
              'x-request-id': ctx.request_id,
              'cache-control': 'no-store',
            }), {
              rateLimitScope,
              idempotencyScope,
              cacheScope,
              idempotencyState,
              topology,
            });
          }

          if (claim.kind === 'in_progress') {
            idempotencyState = 'in_progress';
            return applyRuntimeScopeHeaders(problemResponse({
              status: 409,
              title: 'Idempotent Request In Progress',
              detail: 'A prior request with this Idempotency-Key is still running in request-bound execution. Retry after the stale window or inspect the original request outcome.',
              code: 'idempotency_in_progress',
              traceId: ctx.trace_id,
              requestId: ctx.request_id,
            }), {
              rateLimitScope,
              idempotencyScope,
              cacheScope,
              idempotencyState,
              topology,
            });
          }

          if (claim.kind === 'recovery_required') {
            logStructured('warn', 'api.idempotency.recovery_required', {
              route_id: routeId,
              method: ctx.method,
              trace_id: ctx.trace_id,
              request_id: ctx.request_id,
              tenant_id: ctx.tenant_id,
              actor_id: ctx.actor_id,
              idempotency_key: key,
              recovery_reason: claim.reason,
            });
            idempotencyState = 'recovery_required';
            return applyRuntimeScopeHeaders(problemResponse({
              status: 409,
              title: 'Idempotency Recovery Required',
              detail: 'The previous request may have mutated state before replay metadata was finalized. Reusing this Idempotency-Key is blocked to avoid double-apply; reconcile downstream state before retrying with a new key.',
              code: 'idempotency_recovery_required',
              traceId: ctx.trace_id,
              requestId: ctx.request_id,
              errors: [{ recovery_reason: claim.reason }],
            }), {
              rateLimitScope,
              idempotencyScope,
              cacheScope,
              idempotencyState,
              topology,
            });
          }

          idempotencyState = 'started';
        } else {
          idempotencyScope = MEMORY_SCOPE_HEADER;
          const existing = idempotencyCache.get(idempotencyKeyScope);
          if (existing && existing.expiresAtMs > now) {
            if (existing.requestHash !== idempotencyRequestHash) {
              return applyRuntimeScopeHeaders(problemResponse({
                status: 409,
                title: 'Idempotency Conflict',
                detail: 'Idempotency-Key was reused with a different request body',
                code: 'idempotency_conflict',
                traceId: ctx.trace_id,
                requestId: ctx.request_id,
              }), {
                rateLimitScope,
                idempotencyScope,
                cacheScope,
                topology,
              });
            }

            idempotencyState = 'replayed';
            return applyRuntimeScopeHeaders(fromCachedResponse(existing.response, {
              'x-idempotency-replayed': '1',
              'x-trace-id': ctx.trace_id,
              'x-request-id': ctx.request_id,
              'cache-control': 'no-store',
            }), {
              rateLimitScope,
              idempotencyScope,
              cacheScope,
              idempotencyState,
              topology,
            });
          }
          idempotencyState = 'started';
        }
      }
    }

    return await withObservabilityContext({
      route_id: routeId,
      tenant_id: ctx.tenant_id,
      actor_id: ctx.actor_id,
      request_id: ctx.request_id,
      trace_id: ctx.trace_id,
      method: ctx.method,
      pathname: ctx.pathname,
      idempotency_key: req.headers.get('idempotency-key'),
    }, async () => {
      const policy = await policyEval(ctx);
      if (!policy.allow) {
        logStructured('warn', 'api.policy.denied', {
          route_id: routeId,
          method: ctx.method,
          trace_id: ctx.trace_id,
          request_id: ctx.request_id,
          tenant_id: ctx.tenant_id,
          actor_id: ctx.actor_id,
          reasons: policy.reasons,
        });
        return applyRuntimeScopeHeaders(problemResponse({
          status: 403,
          title: 'Policy Denied',
          detail: policy.reasons.join('; ') || 'Denied',
          code: 'policy_denied',
          traceId: ctx.trace_id,
          requestId: ctx.request_id,
        }), {
          rateLimitScope,
          idempotencyScope,
          cacheScope,
          topology,
        });
      }

      const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(ctx.method);
      if (isMutation) {
        logStructured('info', 'api.mutation.started', {
          route_id: routeId,
          method: ctx.method,
          trace_id: ctx.trace_id,
          request_id: ctx.request_id,
          tenant_id: ctx.tenant_id,
          actor_id: ctx.actor_id,
          idempotency_key: req.headers.get('idempotency-key'),
          execution_model: REQUEST_EXECUTION_MODEL,
        });
      }

      const response = await handler(ctx);
      response.headers.set('x-trace-id', ctx.trace_id);
      response.headers.set('x-request-id', ctx.request_id);
      response.headers.set('cache-control', computeCacheControl(cacheOptions));

      if (cacheOptions && response.status < 400) {
        responseCache.set(
          cacheKeyForRequest(req, ctx, cacheOptions),
          await toCachedResponse(response, now + Math.max(1, cacheOptions.ttlMs)),
        );
      }

      if (idempotencyKeyScope && idempotencyRequestHash && response.status < 500) {
        const responseSnapshot = await toCachedResponse(response, now + idempotencyTtlMs);
        if (productionLike) {
          idempotencyScope = await persistDurableIdempotencyResponse(
            idempotencyKeyScope,
            idempotencyRequestHash,
            idempotencyTtlMs,
            responseSnapshot,
          );
          idempotencyState = 'started';
        } else {
          idempotencyCache.set(idempotencyKeyScope, {
            requestHash: idempotencyRequestHash,
            response: responseSnapshot,
            expiresAtMs: now + idempotencyTtlMs,
          });
          idempotencyState = 'started';
        }
      }

      if (isMutation) {
        logStructured('info', 'api.mutation.completed', {
          route_id: routeId,
          method: ctx.method,
          status: response.status,
          trace_id: ctx.trace_id,
          request_id: ctx.request_id,
          tenant_id: ctx.tenant_id,
          actor_id: ctx.actor_id,
          duration_ms: Date.now() - startedAtMs,
          idempotency_key: req.headers.get('idempotency-key'),
          execution_model: REQUEST_EXECUTION_MODEL,
        });
      }

      logStructured('info', 'api.request.completed', {
        route_id: routeId,
        method: ctx.method,
        status: response.status,
        trace_id: ctx.trace_id,
        request_id: ctx.request_id,
        tenant_id: ctx.tenant_id,
        actor_id: ctx.actor_id,
        duration_ms: Date.now() - startedAtMs,
      });

      return applyRuntimeScopeHeaders(response, {
        rateLimitScope,
        idempotencyScope,
        cacheScope,
        idempotencyState,
        topology,
      });
    });
  } catch (error) {
    const response = unknownErrorToProblem(error, ctx.trace_id, ctx.request_id);
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(ctx.method)) {
      logStructured('error', 'api.mutation.failed', {
        route_id: routeId,
        method: ctx.method,
        status: response.status,
        trace_id: ctx.trace_id,
        request_id: ctx.request_id,
        tenant_id: ctx.tenant_id,
        actor_id: ctx.actor_id,
        duration_ms: Date.now() - startedAtMs,
        idempotency_key: req.headers.get('idempotency-key'),
        execution_model: REQUEST_EXECUTION_MODEL,
      }, error);
    }

    logStructured('error', 'api.request.failed', {
      route_id: routeId,
      method: ctx.method,
      status: response.status,
      trace_id: ctx.trace_id,
      request_id: ctx.request_id,
      tenant_id: ctx.tenant_id,
      actor_id: ctx.actor_id,
      duration_ms: Date.now() - startedAtMs,
      error_name: error instanceof Error ? error.name : 'unknown',
    }, error);
    return applyRuntimeScopeHeaders(response, {
      rateLimitScope,
      idempotencyScope,
      cacheScope,
      idempotencyState,
      topology,
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
  response.headers.set('x-requiem-execution-model', REQUEST_EXECUTION_MODEL);
  return response;
}
