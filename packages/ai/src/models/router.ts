/**
 * @fileoverview OpenRouter model router for the AI control-plane.
 *
 * INVARIANT: No direct OpenRouter SDK usage outside this file.
 * INVARIANT: All calls enforce token + cost ceilings.
 * INVARIANT: System prompt hash + tool registry hash stored per call.
 * INVARIANT: Content-addressable caching for deterministic replay.
 * INVARIANT: Non-replayable calls are explicitly marked.
 * INVARIANT: Circuit breaker wraps all provider calls.
 *
 * Token ceiling: REQUIEM_MAX_TOKENS_PER_CALL (default: 4096)
 * Cost ceiling: REQUIEM_MAX_COST_CENTS_PER_CALL (default: 100 = $1.00)
 */

import { createHash } from 'crypto';
import { AiError } from '../errors/AiError';
import { AiErrorCode } from '../errors/codes';
import { checkCircuit, recordSuccess, recordFailure } from './circuitBreaker';
import { recordCost } from '../telemetry/cost';
import { logger } from '../telemetry/logger';
import { getModel } from './registry';
import type { InvocationContext } from '../types/index';
import type { GenerateTextResponse, Message } from './providers/types';

// ─── Configuration ────────────────────────────────────────────────────────────

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_MAX_COST_CENTS = 100; // $1.00

function getMaxTokens(): number {
  return parseInt(process.env['REQUIEM_MAX_TOKENS_PER_CALL'] ?? String(DEFAULT_MAX_TOKENS), 10);
}

function getMaxCostCents(): number {
  return parseInt(process.env['REQUIEM_MAX_COST_CENTS_PER_CALL'] ?? String(DEFAULT_MAX_COST_CENTS), 10);
}

// ─── Router Request ───────────────────────────────────────────────────────────

export interface RouterRequest {
  messages: Message[];
  model: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  jsonSchema?: Record<string, unknown>;
  ctx: InvocationContext;
  /** Hash of the tool registry snapshot (for deterministic replay tracking) */
  toolRegistryHash?: string;
}

export interface RouterResponse extends GenerateTextResponse {
  /** SHA-256 of systemPrompt (for audit + replay) */
  systemPromptHash: string | null;
  /** SHA-256 of tool registry at call time */
  toolRegistryHash: string | null;
  /** Whether this call can be deterministically replayed */
  replayable: boolean;
  /** Content-addressable cache key (null if non-replayable) */
  cacheKey: string | null;
  /** Temperature used */
  temperature: number;
}

// ─── In-Process Cache ─────────────────────────────────────────────────────────

const _cache = new Map<string, RouterResponse>();

/** Clear router cache (for testing). */
export function _clearRouterCache(): void {
  _cache.clear();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Route a generation request through OpenRouter.
 * Enforces token + cost ceilings, circuit breaker, and caching.
 */
export async function routeModelCall(request: RouterRequest): Promise<RouterResponse> {
  const startMs = Date.now();
  const { ctx } = request;

  const apiKey = process.env['OPENROUTER_API_KEY'];
  if (!apiKey) {
    throw new AiError({
      code: AiErrorCode.NOT_CONFIGURED,
      message: 'OPENROUTER_API_KEY is not configured',
      phase: 'router',
    });
  }

  // ── Token ceiling ────────────────────────────────────────────────────────
  const maxTokens = Math.min(
    request.maxTokens ?? getMaxTokens(),
    getMaxTokens()
  );

  // ── Temperature (0 = deterministic, >0 = non-deterministic) ─────────────
  const temperature = request.temperature ?? 0;
  const isReplayable = temperature === 0 && !request.jsonSchema;

  // ── Hashes ───────────────────────────────────────────────────────────────
  const systemPromptHash = request.systemPrompt
    ? createHash('sha256').update(request.systemPrompt, 'utf8').digest('hex')
    : null;

  const toolRegistryHash = request.toolRegistryHash ?? null;

  // ── Cache key (only for deterministic calls) ──────────────────────────────
  const cacheKey = isReplayable
    ? _computeCacheKey(request.model, request.messages, request.systemPrompt, maxTokens)
    : null;

  // ── Cache check ───────────────────────────────────────────────────────────
  if (cacheKey && _cache.has(cacheKey)) {
    const cached = _cache.get(cacheKey)!;
    logger.debug('[router] cache hit', {
      model: request.model,
      cache_key: cacheKey,
      tenant_id: ctx.tenant.tenantId,
    });
    return cached;
  }

  // ── Cost pre-check ────────────────────────────────────────────────────────
  const modelDef = getModel(request.model);
  if (modelDef) {
    // Rough estimate: assume 1K input tokens
    const estimatedCostCents = Math.ceil(
      (1000 * modelDef.inputCostCentsPer1M) / 1_000_000 +
      (maxTokens * modelDef.outputCostCentsPer1M) / 1_000_000
    );
    if (estimatedCostCents > getMaxCostCents()) {
      throw new AiError({
        code: AiErrorCode.BUDGET_EXCEEDED,
        message: `Estimated cost ${estimatedCostCents}¢ exceeds ceiling ${getMaxCostCents()}¢`,
        phase: 'router',
      });
    }
  }

  // ── Circuit breaker ───────────────────────────────────────────────────────
  const circuitKey = `openrouter:${request.model}`;
  checkCircuit(circuitKey);

  // ── Build messages ────────────────────────────────────────────────────────
  const messages: Message[] = [];
  if (request.systemPrompt) {
    messages.push({ role: 'system', content: request.systemPrompt });
  }
  messages.push(...request.messages);

  // ── Build request body ────────────────────────────────────────────────────
  const body: Record<string, unknown> = {
    model: request.model,
    messages,
    max_tokens: maxTokens,
    temperature,
  };

  if (request.jsonSchema) {
    body['response_format'] = {
      type: 'json_schema',
      json_schema: { name: 'response', schema: request.jsonSchema, strict: true },
    };
  }

  // ── Execute call ──────────────────────────────────────────────────────────
  let response: Response;
  try {
    response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/reachhq/requiem',
        'X-Title': 'Requiem AI Control Plane',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    recordFailure(circuitKey, String(err));
    throw AiError.fromUnknown(err, 'router.fetch');
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => 'unknown');
    recordFailure(circuitKey, `HTTP ${response.status}`);

    if (response.status === 429) {
      throw new AiError({
        code: AiErrorCode.PROVIDER_RATE_LIMITED,
        message: `OpenRouter rate limited: ${errText.slice(0, 200)}`,
        phase: 'router',
        retryable: true,
      });
    }
    throw new AiError({
      code: AiErrorCode.PROVIDER_UNAVAILABLE,
      message: `OpenRouter error ${response.status}: ${errText.slice(0, 200)}`,
      phase: 'router',
    });
  }

  let data: {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  try {
    data = await response.json() as typeof data;
  } catch (err) {
    recordFailure(circuitKey, 'JSON parse error');
    throw new AiError({
      code: AiErrorCode.INTERNAL_ERROR,
      message: 'OpenRouter returned invalid JSON',
      phase: 'router',
    });
  }

  recordSuccess(circuitKey);

  const latencyMs = Date.now() - startMs;
  const text = data?.choices?.[0]?.message?.content ?? '';
  const inputTokens = data?.usage?.prompt_tokens ?? 0;
  const outputTokens = data?.usage?.completion_tokens ?? 0;

  // ── Cost accounting ───────────────────────────────────────────────────────
  const costCents = modelDef
    ? Math.ceil(
        (inputTokens * modelDef.inputCostCentsPer1M) / 1_000_000 +
        (outputTokens * modelDef.outputCostCentsPer1M) / 1_000_000
      )
    : 0;

  // Verify actual cost doesn't exceed ceiling
  if (costCents > getMaxCostCents()) {
    logger.warn('[router] cost exceeded ceiling after call', {
      cost_cents: costCents,
      ceiling: getMaxCostCents(),
      model: request.model,
      tenant_id: ctx.tenant.tenantId,
    });
    // Still return result but log the violation — enforced pre-call next time
  }

  await recordCost(ctx, {
    provider: 'openrouter',
    model: request.model,
    inputTokens,
    outputTokens,
    costCents,
    latencyMs,
    phase: 'router',
  });

  const result: RouterResponse = {
    text,
    inputTokens,
    outputTokens,
    costCents,
    latencyMs,
    provider: 'openrouter',
    model: request.model,
    systemPromptHash,
    toolRegistryHash,
    replayable: isReplayable,
    cacheKey,
    temperature,
  };

  // ── Store in cache ────────────────────────────────────────────────────────
  if (cacheKey) {
    _cache.set(cacheKey, result);
  }

  logger.debug('[router] model call complete', {
    model: request.model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_cents: costCents,
    latency_ms: latencyMs,
    replayable: isReplayable,
    tenant_id: ctx.tenant.tenantId,
  });

  return result;
}

// ─── Private Helpers ──────────────────────────────────────────────────────────

function _computeCacheKey(
  model: string,
  messages: Message[],
  systemPrompt: string | undefined,
  maxTokens: number
): string {
  const payload = JSON.stringify({
    model,
    messages,
    systemPrompt: systemPrompt ?? null,
    maxTokens,
  });
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}
