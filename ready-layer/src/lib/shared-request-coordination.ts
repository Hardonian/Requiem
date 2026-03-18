import { ProblemError } from './problem-json';
import { isProductionLikeRuntime } from './runtime-mode';
import { getSupabaseServiceClient } from './supabase-service';

export interface SharedRateLimitOptions {
  capacity: number;
  refillPerSecond: number;
  cost: number;
}

export type SharedCoordinationScope = 'memory-single-process' | 'durable-shared';

export interface SharedRateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
  scope: SharedCoordinationScope;
}

export interface IdempotencyReplaySnapshot {
  status: number;
  headers: Array<[string, string]>;
  bodyText: string;
}

export type SharedIdempotencyClaim =
  | { kind: 'started'; scope: SharedCoordinationScope }
  | { kind: 'replay'; scope: SharedCoordinationScope; response: IdempotencyReplaySnapshot }
  | { kind: 'conflict'; scope: SharedCoordinationScope }
  | { kind: 'in_progress'; scope: SharedCoordinationScope };

const RATE_LIMIT_CODE = 'shared_runtime_coordination_unconfigured';
const IDEMPOTENCY_CODE = 'shared_runtime_coordination_unconfigured';

function coercePositiveNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function maybeNoRow(error: { code?: string } | null): boolean {
  return Boolean(error && error.code === 'PGRST116');
}

export async function consumeDurableRateLimit(
  key: string,
  options: SharedRateLimitOptions,
): Promise<SharedRateLimitResult | null> {
  const client = getSupabaseServiceClient({
    feature: 'Shared rate limiting',
    code: RATE_LIMIT_CODE,
  });
  if (!client) {
    return null;
  }

  const now = Date.now();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await client
      .from('rate_limit_buckets')
      .select('scope_key, tokens, last_refill_ms, revision')
      .eq('scope_key', key)
      .maybeSingle();

    if (error && !maybeNoRow(error)) {
      throw new ProblemError(503, 'Runtime Coordination Unavailable', 'Shared rate limiting state could not be loaded.', {
        code: 'shared_runtime_coordination_unavailable',
      });
    }

    const currentTokens = data ? coercePositiveNumber(data.tokens, options.capacity) : options.capacity;
    const lastRefillMs = data ? coercePositiveNumber(data.last_refill_ms, now) : now;
    const revision = data ? coercePositiveNumber(data.revision, 0) : 0;
    const elapsedSec = Math.max(0, (now - lastRefillMs) / 1000);
    const refilled = Math.min(options.capacity, currentTokens + (elapsedSec * options.refillPerSecond));
    const remaining = refilled - options.cost;
    const nextTokens = remaining < 0 ? refilled : remaining;
    const retryAfterSec = remaining < 0
      ? Math.max(1, Math.ceil(Math.abs(remaining) / options.refillPerSecond))
      : 0;

    if (!data) {
      const insertPayload = {
        scope_key: key,
        tokens: nextTokens,
        last_refill_ms: now,
        revision: 1,
      };
      const { error: insertError } = await client
        .from('rate_limit_buckets')
        .insert(insertPayload);
      if (!insertError) {
        return { allowed: remaining >= 0, retryAfterSec, scope: 'durable-shared' };
      }
      if (insertError.code === '23505') {
        continue;
      }
      throw new ProblemError(503, 'Runtime Coordination Unavailable', 'Shared rate limiting state could not be initialized.', {
        code: 'shared_runtime_coordination_unavailable',
      });
    }

    const { data: updated, error: updateError } = await client
      .from('rate_limit_buckets')
      .update({
        tokens: nextTokens,
        last_refill_ms: now,
        revision: revision + 1,
      })
      .eq('scope_key', key)
      .eq('revision', revision)
      .select('scope_key')
      .maybeSingle();

    if (!updateError && updated) {
      return { allowed: remaining >= 0, retryAfterSec, scope: 'durable-shared' };
    }
    if (updateError && !maybeNoRow(updateError)) {
      throw new ProblemError(503, 'Runtime Coordination Unavailable', 'Shared rate limiting state could not be persisted.', {
        code: 'shared_runtime_coordination_unavailable',
      });
    }
  }

  throw new ProblemError(409, 'Concurrent Request Conflict', 'Could not apply shared rate limiting state safely after repeated retries.', {
    code: 'shared_runtime_coordination_conflict',
  });
}

export async function claimDurableIdempotency(
  scopeKey: string,
  requestHash: string,
  ttlMs: number,
): Promise<SharedIdempotencyClaim | null> {
  const client = getSupabaseServiceClient({
    feature: 'Durable idempotency protection',
    code: IDEMPOTENCY_CODE,
  });
  if (!client) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const expiresIso = new Date(Date.now() + ttlMs).toISOString();

  const { error: insertError } = await client
    .from('request_idempotency')
    .insert({
      scope_key: scopeKey,
      request_hash: requestHash,
      status: 'pending',
      expires_at: expiresIso,
      created_at: nowIso,
      updated_at: nowIso,
    });

  if (!insertError) {
    return { kind: 'started', scope: 'durable-shared' };
  }

  if (insertError.code !== '23505') {
    throw new ProblemError(503, 'Runtime Coordination Unavailable', 'Idempotency state could not be created.', {
      code: 'shared_runtime_coordination_unavailable',
    });
  }

  const { data, error } = await client
    .from('request_idempotency')
    .select('request_hash, status, response_status, response_headers, response_body, expires_at')
    .eq('scope_key', scopeKey)
    .maybeSingle();

  if (error || !data) {
    throw new ProblemError(503, 'Runtime Coordination Unavailable', 'Idempotency state could not be reloaded.', {
      code: 'shared_runtime_coordination_unavailable',
    });
  }

  const expiresAtMs = Date.parse(String(data.expires_at ?? ''));
  const isExpired = Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();
  if (isExpired) {
    const { error: resetError } = await client
      .from('request_idempotency')
      .update({
        request_hash: requestHash,
        status: 'pending',
        response_status: null,
        response_headers: null,
        response_body: null,
        expires_at: expiresIso,
        updated_at: nowIso,
      })
      .eq('scope_key', scopeKey);
    if (!resetError) {
      return { kind: 'started', scope: 'durable-shared' };
    }
  }

  if (data.request_hash !== requestHash) {
    return { kind: 'conflict', scope: 'durable-shared' };
  }

  if (data.status === 'completed') {
    return {
      kind: 'replay',
      scope: 'durable-shared',
      response: {
        status: coercePositiveNumber(data.response_status, 200),
        headers: Array.isArray(data.response_headers) ? data.response_headers as Array<[string, string]> : [],
        bodyText: typeof data.response_body === 'string' ? data.response_body : '',
      },
    };
  }

  return { kind: 'in_progress', scope: 'durable-shared' };
}

export async function persistDurableIdempotencyResponse(
  scopeKey: string,
  requestHash: string,
  ttlMs: number,
  response: IdempotencyReplaySnapshot,
): Promise<SharedCoordinationScope | null> {
  const client = getSupabaseServiceClient({
    feature: 'Durable idempotency protection',
    code: IDEMPOTENCY_CODE,
  });
  if (!client) {
    return null;
  }

  const expiresIso = new Date(Date.now() + ttlMs).toISOString();
  const { error } = await client
    .from('request_idempotency')
    .update({
      request_hash: requestHash,
      status: 'completed',
      response_status: response.status,
      response_headers: response.headers,
      response_body: response.bodyText,
      expires_at: expiresIso,
      updated_at: new Date().toISOString(),
    })
    .eq('scope_key', scopeKey)
    .eq('request_hash', requestHash);

  if (error) {
    throw new ProblemError(503, 'Runtime Coordination Unavailable', 'Idempotency response could not be persisted.', {
      code: 'shared_runtime_coordination_unavailable',
    });
  }

  return 'durable-shared';
}

export function ensureSharedCoordinationAvailable(feature: 'rate_limit' | 'idempotency'): void {
  if (!isProductionLikeRuntime()) {
    return;
  }

  getSupabaseServiceClient({
    feature: feature === 'rate_limit' ? 'Shared rate limiting' : 'Durable idempotency protection',
    code: 'shared_runtime_coordination_unconfigured',
  });
}
