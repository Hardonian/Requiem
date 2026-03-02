/**
 * @fileoverview Provider Arbitration Engine
 *
 * Deterministic, policy-driven provider selection.
 *
 * INVARIANT: Arbitration is opt-in only.
 * INVARIANT: Selection is deterministic based on input fingerprint.
 * INVARIANT: Graceful degradation - returns undefined if no provider available.
 */

import { createHash } from 'crypto';
import { getModel, listModels, getDefaultModel } from './registry.js';
import { checkCircuit } from './circuitBreaker.js';
import { AiError } from '../errors/AiError.js';
import { AiErrorCode } from '../errors/codes.js';
import { logger } from '../telemetry/logger.js';
import type { InvocationContext } from '../types/index.js';
import type { ModelDefinition } from './registry.js';
import {
  type ArbitrationRequest,
  type ArbitrationResult,
  type ArbitrationDecisionLog,
  type IArbitrationEngine,
  type SelectionStrategy,
  type ProviderRequirements,
  type ProviderConstraints,
  type DecisionFactor,
  DEFAULT_ARBITRATION_POLICY,
  getModelQualityTier,
  estimateLatencyTier,
  modelMeetsRequirements,
  modelPassesConstraints,
} from './arbitration.js';
import { loadFlags } from '../flags/index.js';

// ─── Engine State ───────────────────────────────────────────────────────────────

/**
 * Arbitration engine with deterministic selection.
 */
export class ArbitrationEngine implements IArbitrationEngine {
  private decisionLogs: ArbitrationDecisionLog[] = [];
  private readonly maxLogs = 1000;

  /**
   * Select the best provider/model for a request.
   */
  async select(request: ArbitrationRequest): Promise<ArbitrationResult | undefined> {
    // Load feature flags
    const flags = loadFlags();

    // Graceful degradation: if arbitration not enabled, return undefined
    // This allows existing pinned provider flows to work unchanged
    if (!flags.enable_provider_arbitration) {
      logger.debug('[arbitration] feature disabled, returning undefined');
      return undefined;
    }

    const { requirements, constraints, ctx } = request;

    // Get available models that pass constraints and requirements
    const candidates = this.getAvailableModels(constraints, requirements);

    if (candidates.length === 0) {
      logger.warn('[arbitration] no candidates found', {
        purpose: request.purpose,
        tenant_id: request.tenantId,
      });
      return undefined;
    }

    // Check circuit breaker for each candidate
    const availableCandidates = candidates.filter((model) => {
      try {
        checkCircuit(`${model.provider}:${model.id}`);
        return true;
      } catch {
        logger.debug('[arbitration] circuit open for', { model: model.id });
        return false;
      }
    });

    if (availableCandidates.length === 0) {
      logger.warn('[arbitration] all candidates circuit-open', {
        candidates: candidates.map((c) => c.id),
      });
      return undefined;
    }

    // Select using the appropriate strategy
    const selected = this.selectByStrategy(
      availableCandidates,
      request.inputFingerprint,
      'balanced' // Default strategy - can be made configurable
    );

    if (!selected) {
      return undefined;
    }

    // Build result
    const result = this.buildResult(selected, request, availableCandidates);

    // Log decision
    await this.logDecision({
      decisionId: this.generateDecisionId(),
      request,
      result,
      timestamp: new Date().toISOString(),
      traceId: ctx.traceId,
      cached: false,
    });

    return result;
  }

  /**
   * Log an arbitration decision.
   */
  async logDecision(log: ArbitrationDecisionLog): Promise<void> {
    this.decisionLogs.push(log);
    if (this.decisionLogs.length > this.maxLogs) {
      this.decisionLogs.shift();
    }
  }

  /**
   * Get recent decision logs.
   */
  getDecisionLogs(limit = 100): ArbitrationDecisionLog[] {
    return this.decisionLogs.slice(-limit);
  }

  /**
   * Check if a provider is available (circuit breaker aware).
   */
  async isProviderAvailable(provider: string): Promise<boolean> {
    try {
      checkCircuit(`${provider}:default`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get available models matching constraints.
   */
  getAvailableModels(
    constraints: ProviderConstraints,
    requirements: ProviderRequirements
  ): ModelDefinition[] {
    const allModels = listModels();

    return allModels.filter((model) => {
      // Check constraints
      const constraintCheck = modelPassesConstraints(model, constraints);
      if (!constraintCheck.passes) {
        return false;
      }

      // Check requirements
      const requirementCheck = modelMeetsRequirements(model, requirements);
      if (!requirementCheck.meets) {
        return false;
      }

      return true;
    });
  }

  // ─── Private Methods ─────────────────────────────────────────────────────────

  /**
   * Select a model using the specified strategy.
   */
  private selectByStrategy(
    candidates: ModelDefinition[],
    inputFingerprint: string,
    strategy: SelectionStrategy
  ): ModelDefinition | undefined {
    switch (strategy) {
      case 'cost-optimized':
        return this.selectCostOptimized(candidates);
      case 'latency-optimized':
        return this.selectLatencyOptimized(candidates);
      case 'quality-first':
        return this.selectQualityFirst(candidates);
      case 'deterministic-hash':
        return this.selectByHash(candidates, inputFingerprint);
      case 'balanced':
      default:
        return this.selectBalanced(candidates, inputFingerprint);
    }
  }

  /**
   * Select lowest cost model.
   */
  private selectCostOptimized(candidates: ModelDefinition[]): ModelDefinition | undefined {
    return candidates.reduce((best, current) => {
      if (!best) return current;
      const currentCost = current.inputCostCentsPer1M + current.outputCostCentsPer1M;
      const bestCost = best.inputCostCentsPer1M + best.outputCostCentsPer1M;
      return currentCost < bestCost ? current : best;
    }, undefined as ModelDefinition | undefined);
  }

  /**
   * Select by estimated latency.
   */
  private selectLatencyOptimized(candidates: ModelDefinition[]): ModelDefinition | undefined {
    return candidates.reduce((best, current) => {
      if (!best) return current;
      const currentLatency = estimateLatencyTier(current);
      const bestLatency = estimateLatencyTier(best);
      const latencyOrder = ['low', 'medium', 'high'];
      return latencyOrder.indexOf(currentLatency) < latencyOrder.indexOf(bestLatency)
        ? current
        : best;
    }, undefined as ModelDefinition | undefined);
  }

  /**
   * Select highest quality model.
   */
  private selectQualityFirst(candidates: ModelDefinition[]): ModelDefinition | undefined {
    return candidates.reduce((best, current) => {
      if (!best) return current;
      const currentTier = getModelQualityTier(current);
      const bestTier = getModelQualityTier(best);
      const tierOrder = ['low', 'medium', 'high', 'premium'];
      return tierOrder.indexOf(currentTier) > tierOrder.indexOf(bestTier) ? current : best;
    }, undefined as ModelDefinition | undefined);
  }

  /**
   * Select using hash-based deterministic selection.
   * This ensures the same input always selects the same model.
   */
  private selectByHash(candidates: ModelDefinition[], inputFingerprint: string): ModelDefinition | undefined {
    if (candidates.length === 0) return undefined;
    if (candidates.length === 1) return candidates[0];

    // Create deterministic index from fingerprint
    const hash = createHash('sha256')
      .update(inputFingerprint)
      .digest('hex');
    const index = parseInt(hash.slice(0, 8), 16) % candidates.length;

    return candidates[index];
  }

  /**
   * Select using balanced scoring.
   */
  private selectBalanced(
    candidates: ModelDefinition[],
    inputFingerprint: string
  ): ModelDefinition | undefined {
    if (candidates.length === 0) return undefined;
    if (candidates.length === 1) return candidates[0];

    // Score each candidate
    const scored = candidates.map((model) => {
      const factors = this.scoreModel(model);
      const totalScore = factors.reduce((sum, f) => sum + f.weight * f.score, 0);
      return { model, score: totalScore, factors };
    });

    // If we have few candidates, use hash-based tiebreaker
    scored.sort((a, b) => b.score - a.score);

    // Check for tie and use hash-based selection
    const topScore = scored[0].score;
    const topCandidates = scored.filter((s) => s.score === topScore);

    if (topCandidates.length > 1) {
      return this.selectByHash(topCandidates.map((s) => s.model), inputFingerprint);
    }

    return scored[0].model;
  }

  /**
   * Score a model and return decision factors.
   */
  private scoreModel(model: ModelDefinition): DecisionFactor[] {
    const factors: DecisionFactor[] = [];

    // Cost factor (lower is better)
    const totalCost = model.inputCostCentsPer1M + model.outputCostCentsPer1M;
    const costScore = Math.max(0, 100 - totalCost / 10); // Normalize to 0-100
    factors.push({
      name: 'cost',
      weight: 0.3,
      score: costScore,
      explanation: `Total cost: ${totalCost}¢/1M tokens`,
    });

    // Quality factor
    const qualityTier = getModelQualityTier(model);
    const qualityScores: Record<string, number> = {
      low: 25,
      medium: 50,
      high: 75,
      premium: 100,
    };
    factors.push({
      name: 'quality',
      weight: 0.4,
      score: qualityScores[qualityTier] || 50,
      explanation: `Quality tier: ${qualityTier}`,
    });

    // Latency factor (lower is better)
    const latencyTier = estimateLatencyTier(model);
    const latencyScores: Record<string, number> = {
      low: 100,
      medium: 66,
      high: 33,
    };
    factors.push({
      name: 'latency',
      weight: 0.3,
      score: latencyScores[latencyTier] || 50,
      explanation: `Estimated latency: ${latencyTier}`,
    });

    return factors;
  }

  /**
   * Build the final result.
   */
  private buildResult(
    model: ModelDefinition,
    request: ArbitrationRequest,
    candidates: ModelDefinition[]
  ): ArbitrationResult {
    const factors = this.scoreModel(model);
    const isFallback = candidates.length > 1 && candidates[0]?.id !== model.id;

    // Estimate cost and latency
    const estimatedCostCents = model.inputCostCentsPer1M + model.outputCostCentsPer1M;
    const latencyMap: Record<string, number> = {
      low: 500,
      medium: 2000,
      high: 5000,
    };
    const estimatedLatencyMs = latencyMap[estimateLatencyTier(model)] || 2000;

    return {
      provider: model.provider,
      model: model.id,
      modelDefinition: model,
      reason: factors.map((f) => f.explanation).join('; '),
      decisionFactors: factors,
      isFallback,
      estimatedCostCents,
      estimatedLatencyMs,
    };
  }

  /**
   * Generate a unique decision ID.
   */
  private generateDecisionId(): string {
    return `arb_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}

// ─── Global Engine Instance ───────────────────────────────────────────────────

let _engine: ArbitrationEngine | null = null;

export function getArbitrationEngine(): ArbitrationEngine {
  if (!_engine) {
    _engine = new ArbitrationEngine();
  }
  return _engine;
}

export function setArbitrationEngine(engine: ArbitrationEngine): void {
  _engine = engine;
}

// ─── Convenience Functions ───────────────────────────────────────────────────

/**
 * Create an arbitration request from a generate text request.
 */
export function createArbitrationRequest(
  purpose: 'chat' | 'tool' | 'analysis' | 'summarization',
  ctx: InvocationContext,
  options?: {
    maxCost?: number;
    maxLatencyMs?: number;
    preferredProvider?: string;
    preferredModel?: string;
  }
): ArbitrationRequest {
  const inputFingerprint = createHash('sha256')
    .update(JSON.stringify({ purpose, timestamp: Date.now() }))
    .digest('hex');

  return {
    purpose,
    tenantId: ctx.tenant?.tenantId,
    runId: ctx.traceId,
    stepId: undefined,
    inputFingerprint,
    requirements: {
      allowFallbacks: true,
      maxCost: options?.maxCost,
      maxLatencyMs: options?.maxLatencyMs,
    },
    constraints: {
      allowedProviders: options?.preferredProvider ? [options.preferredProvider] : undefined,
      allowedModels: options?.preferredModel ? [options.preferredModel] : undefined,
    },
    ctx,
  };
}

/**
 * Execute generation with arbitration.
 * Falls back to default model if arbitration disabled or fails.
 */
export async function generateWithArbitration(
  request: ArbitrationRequest
): Promise<ArbitrationResult | undefined> {
  const engine = getArbitrationEngine();
  return engine.select(request);
}
