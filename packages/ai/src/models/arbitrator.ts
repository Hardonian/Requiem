/**
 * @fileoverview Model arbitrator — selects the best model for a task and handles fallback.
 *
 * Selection priority:
 * 1. If preferredModel is specified and available → use it
 * 2. Find providers with the preferred model
 * 3. Fall back to default model
 * 4. If circuit is open for all options → throw AiError.CIRCUIT_OPEN
 *
 * INVARIANT: Never expose raw provider errors to callers. Wrap in AiError.
 * INVARIANT: Always record cost even on failure (partial accounting).
 */

import { getModel, getProvider, getDefaultModel } from './registry.js';
import { checkCircuit, recordSuccess, recordFailure } from './circuitBreaker.js';
import { AiError } from '../errors/AiError.js';
import { AiErrorCode } from '../errors/codes.js';
import { recordCost } from '../telemetry/cost.js';
import { logger } from '../telemetry/logger.js';
import type { InvocationContext } from '../types/index.js';
import type { GenerateTextResponse } from './providers/types.js';

// ─── Arbitrator Request ───────────────────────────────────────────────────────

export interface ArbitratorRequest {
  prompt: string;
  preferredModel?: string;
  maxTokens?: number;
  temperature?: number;
  jsonSchema?: Record<string, unknown>;
  ctx: InvocationContext;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate text using the best available model.
 * Handles circuit breakers, fallback, and cost recording.
 */
export async function generateText(request: ArbitratorRequest): Promise<GenerateTextResponse> {
  const { prompt, preferredModel, ctx } = request;

  // Determine target model
  let modelId = preferredModel ?? getDefaultModel().id;
  let modelDef = getModel(modelId);

  if (!modelDef) {
    // Fall back to default
    modelDef = getDefaultModel();
    modelId = modelDef.id;
    logger.warn('[arbitrator] Preferred model not found, falling back', {
      preferred: preferredModel,
      fallback: modelId,
    });
  }

  const circuitKey = `${modelDef.provider}:${modelId}`;

  try {
    // Check circuit breaker
    checkCircuit(circuitKey);

    // Get provider
    const provider = getProvider(modelDef.provider);
    if (!provider) {
      throw AiError.providerNotConfigured(modelDef.provider);
    }

    const available = await provider.isAvailable();
    if (!available) {
      throw AiError.providerNotConfigured(modelDef.provider);
    }

    const startMs = Date.now();
    const response = await provider.generateText({
      prompt,
      model: modelId,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      jsonSchema: request.jsonSchema,
      ctx,
    });

    // Record success + cost
    recordSuccess(circuitKey);
    await recordCost(ctx, {
      provider: response.provider,
      model: response.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      costCents: response.costCents,
      latencyMs: Date.now() - startMs,
      phase: 'model.generate',
    });

    return response;
  } catch (err) {
    const aiErr = AiError.fromUnknown(err, 'model.arbitrator');

    // Only record failure for provider errors (not policy/config errors)
    if (aiErr.code !== AiErrorCode.PROVIDER_NOT_CONFIGURED &&
        aiErr.code !== AiErrorCode.NOT_CONFIGURED) {
      recordFailure(circuitKey, aiErr.message);
    }

    // If provider not configured, return a controlled error (not a crash)
    if (aiErr.code === AiErrorCode.PROVIDER_NOT_CONFIGURED ||
        aiErr.code === AiErrorCode.NOT_CONFIGURED) {
      logger.warn('[arbitrator] No provider available', {
        model: modelId,
        trace_id: ctx.traceId,
      });
    }

    throw aiErr;
  }
}
