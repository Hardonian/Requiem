/**
 * @fileoverview Provider Arbitration Core Types
 *
 * Deterministic, policy-driven provider selection for multi-model routing.
 *
 * INVARIANT: Arbitration is opt-in only (feature flag controlled).
 * INVARIANT: Once enabled, selection is deterministic given same inputs.
 * INVARIANT: No changes to existing pinned provider flows.
 * INVARIANT: Graceful degradation - never hard-500, always fallback.
 */

import type { InvocationContext } from '../types/index.js';
import type { ModelDefinition } from './registry.js';

// ─── Request Purpose Enum ───────────────────────────────────────────────────────

export type RequestPurpose =
  | 'chat'           // General conversation
  | 'embed'          // Embedding generation
  | 'tool'           // Tool execution result processing
  | 'moderation'     // Content moderation
  | 'analysis'       // Deep analysis
  | 'summarization'; // Text summarization

// ─── Quality Tier ───────────────────────────────────────────────────────────────

export type QualityTier = 'low' | 'medium' | 'high' | 'premium';

// ─── Provider Requirements ─────────────────────────────────────────────────────

export interface ProviderRequirements {
  /** Maximum cost in USD cents for this request */
  maxCost?: number;
  /** Maximum latency in milliseconds */
  maxLatencyMs?: number;
  /** Minimum quality tier required */
  minQualityTier?: QualityTier;
  /** Whether to allow fallback to lower-tier providers */
  allowFallbacks: boolean;
  /** Preferred geographic region */
  regionPreference?: string;
  /** Privacy mode - no data leaves specified region */
  privacyMode?: boolean;
}

// ─── Provider Constraints ─────────────────────────────────────────────────────

export interface ProviderConstraints {
  /** Allowed provider names (empty = all allowed) */
  allowedProviders?: string[];
  /** Allowed model IDs (empty = all allowed) */
  allowedModels?: string[];
  /** Blocked provider names */
  blockedProviders?: string[];
  /** Blocked model IDs */
  blockedModels?: string[];
}

// ─── Arbitration Request ─────────────────────────────────────────────────────

export interface ArbitrationRequest {
  /** Purpose of the request */
  purpose: RequestPurpose;
  /** Tenant ID (optional for system-wide) */
  tenantId?: string;
  /** Run ID for tracing */
  runId: string;
  /** Step ID within the run */
  stepId?: string;
  /** Fingerprint of normalized inputs (SHA-256) */
  inputFingerprint: string;
  /** Policy-driven requirements */
  requirements: ProviderRequirements;
  /** Provider/model constraints */
  constraints: ProviderConstraints;
  /** Invocation context */
  ctx: InvocationContext;
}

// ─── Arbitration Result ───────────────────────────────────────────────────────

export interface ArbitrationResult {
  /** Selected provider name */
  provider: string;
  /** Selected model ID */
  model: string;
  /** Full model definition */
  modelDefinition: ModelDefinition;
  /** Reasoning for selection (for observability) */
  reason: string;
  /** Decision factors used */
  decisionFactors: DecisionFactor[];
  /** Whether this was a fallback selection */
  isFallback: boolean;
  /** Estimated cost in cents */
  estimatedCostCents: number;
  /** Estimated latency in ms */
  estimatedLatencyMs: number;
}

// ─── Decision Factor ──────────────────────────────────────────────────────────

export interface DecisionFactor {
  /** Factor name */
  name: string;
  /** Factor weight in selection (0-1) */
  weight: number;
  /** Score for this factor (0-100) */
  score: number;
  /** Why this factor influenced the decision */
  explanation: string;
}

// ─── Selection Strategy ───────────────────────────────────────────────────────

export type SelectionStrategy =
  | 'cost-optimized'     // Lowest cost within constraints
  | 'latency-optimized'  // Fastest response within constraints
  | 'quality-first'      // Highest quality within budget
  | 'balanced'           // Balance cost/quality/latency
  | 'deterministic-hash'; // Hash-based deterministic selection

// ─── Arbitration Policy ───────────────────────────────────────────────────────

export interface ArbitrationPolicy {
  /** Policy name */
  name: string;
  /** Policy version */
  version: string;
  /** Default strategy if not specified in request */
  defaultStrategy: SelectionStrategy;
  /** Default requirements if not specified in request */
  defaultRequirements: ProviderRequirements;
  /** Default constraints if not specified in request */
  defaultConstraints: ProviderConstraints;
  /** Whether arbitration is enabled for this tenant */
  enabled: boolean;
}

// ─── Arbitration Decision Log ───────────────────────────────────────────────

export interface ArbitrationDecisionLog {
  /** Unique decision ID */
  decisionId: string;
  /** Request that triggered this decision */
  request: ArbitrationRequest;
  /** Result of the arbitration */
  result: ArbitrationResult;
  /** Timestamp */
  timestamp: string;
  /** Trace ID for correlation */
  traceId: string;
  /** Whether the decision was cached */
  cached: boolean;
}

// ─── Arbitration Engine Interface ───────────────────────────────────────────

export interface IArbitrationEngine {
  /**
   * Select the best provider/model for a request.
   * Returns undefined if no suitable provider found (graceful degradation).
   */
  select(request: ArbitrationRequest): Promise<ArbitrationResult | undefined>;

  /**
   * Log an arbitration decision for observability.
   */
  logDecision(log: ArbitrationDecisionLog): Promise<void>;

  /**
   * Check if a provider is currently available (circuit breaker aware).
   */
  isProviderAvailable(provider: string): Promise<boolean>;

  /**
   * Get available models matching constraints.
   */
  getAvailableModels(
    constraints: ProviderConstraints,
    requirements: ProviderRequirements
  ): ModelDefinition[];
}

// ─── Default Arbitration Policy ───────────────────────────────────────────────

export const DEFAULT_ARBITRATION_POLICY: ArbitrationPolicy = {
  name: 'default',
  version: '1.0.0',
  defaultStrategy: 'balanced',
  defaultRequirements: {
    allowFallbacks: true,
  },
  defaultConstraints: {},
  enabled: false, // Opt-in only
};

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Get quality tier from model capabilities
 */
export function getModelQualityTier(model: ModelDefinition): QualityTier {
  const caps = model.capabilities;
  if (caps.includes('complex-reasoning')) return 'premium';
  if (caps.includes('analysis')) return 'high';
  if (caps.includes('code')) return 'medium';
  return 'low';
}

/**
 * Estimate latency tier from model
 */
export function estimateLatencyTier(model: ModelDefinition): 'low' | 'medium' | 'high' {
  // Larger models typically have higher latency
  if (model.id.includes('opus') || model.id.includes('gpt-4')) return 'high';
  if (model.id.includes('sonnet') || model.id.includes('gpt-4o')) return 'medium';
  return 'low';
}

/**
 * Check if a model meets requirements
 */
export function modelMeetsRequirements(
  model: ModelDefinition,
  requirements: ProviderRequirements
): { meets: boolean; reason?: string } {
  // Check quality tier
  if (requirements.minQualityTier) {
    const modelTier = getModelQualityTier(model);
    const tierOrder: QualityTier[] = ['low', 'medium', 'high', 'premium'];
    const modelTierIdx = tierOrder.indexOf(modelTier);
    const requiredTierIdx = tierOrder.indexOf(requirements.minQualityTier);
    if (modelTierIdx < requiredTierIdx) {
      return { meets: false, reason: `Quality tier ${modelTier} below required ${requirements.minQualityTier}` };
    }
  }

  // Check cost constraint
  if (requirements.maxCost !== undefined) {
    if (model.inputCostCentsPer1M > requirements.maxCost) {
      return { meets: false, reason: `Input cost exceeds max ${requirements.maxCost}¢` };
    }
  }

  return { meets: true };
}

/**
 * Check if a model passes constraints
 */
export function modelPassesConstraints(
  model: ModelDefinition,
  constraints: ProviderConstraints
): { passes: boolean; reason?: string } {
  // Check allowed providers
  if (constraints.allowedProviders?.length) {
    if (!constraints.allowedProviders.includes(model.provider)) {
      return { passes: false, reason: `Provider ${model.provider} not in allowed list` };
    }
  }

  // Check blocked providers
  if (constraints.blockedProviders?.length) {
    if (constraints.blockedProviders.includes(model.provider)) {
      return { passes: false, reason: `Provider ${model.provider} is blocked` };
    }
  }

  // Check allowed models
  if (constraints.allowedModels?.length) {
    if (!constraints.allowedModels.includes(model.id)) {
      return { passes: false, reason: `Model ${model.id} not in allowed list` };
    }
  }

  // Check blocked models
  if (constraints.blockedModels?.length) {
    if (constraints.blockedModels.includes(model.id)) {
      return { passes: false, reason: `Model ${model.id} is blocked` };
    }
  }

  return { passes: true };
}
