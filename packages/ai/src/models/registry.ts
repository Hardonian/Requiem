/**
 * @fileoverview Model registry — centralized management of AI model providers.
 */

import { AiError } from '../errors/AiError.js';
import { AiErrorCode } from '../errors/codes.js';
import type { ModelProvider } from './providers/types.js';

// ─── Model Definition ─────────────────────────────────────────────────────────

export interface ModelDefinition {
  readonly id: string;
  readonly provider: string;
  readonly displayName: string;
  readonly contextLength: number;
  readonly capabilities: readonly string[];
  /** Cost per 1M input tokens in USD cents */
  readonly inputCostCentsPer1M: number;
  /** Cost per 1M output tokens in USD cents */
  readonly outputCostCentsPer1M: number;
  readonly isDefault: boolean;
}

// ─── Registry State ───────────────────────────────────────────────────────────

const _models = new Map<string, ModelDefinition>();
const _providers = new Map<string, ModelProvider>();

// ─── Built-in Model Catalog ───────────────────────────────────────────────────

const BUILTIN_MODELS: ModelDefinition[] = [
  {
    id: 'claude-sonnet-4-6',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4.6',
    contextLength: 200_000,
    capabilities: ['text', 'code', 'analysis', 'json'],
    inputCostCentsPer1M: 30,
    outputCostCentsPer1M: 150,
    isDefault: true,
  },
  {
    id: 'claude-opus-4-6',
    provider: 'anthropic',
    displayName: 'Claude Opus 4.6',
    contextLength: 200_000,
    capabilities: ['text', 'code', 'analysis', 'json', 'complex-reasoning'],
    inputCostCentsPer1M: 1500,
    outputCostCentsPer1M: 7500,
    isDefault: false,
  },
  {
    id: 'claude-haiku-4-5-20251001',
    provider: 'anthropic',
    displayName: 'Claude Haiku 4.5',
    contextLength: 200_000,
    capabilities: ['text', 'code', 'json'],
    inputCostCentsPer1M: 5,
    outputCostCentsPer1M: 25,
    isDefault: false,
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4o',
    contextLength: 128_000,
    capabilities: ['text', 'code', 'analysis', 'json', 'vision'],
    inputCostCentsPer1M: 50,
    outputCostCentsPer1M: 150,
    isDefault: false,
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    displayName: 'GPT-4o Mini',
    contextLength: 128_000,
    capabilities: ['text', 'code', 'json'],
    inputCostCentsPer1M: 5,
    outputCostCentsPer1M: 15,
    isDefault: false,
  },
];

// Pre-populate with builtin models
for (const model of BUILTIN_MODELS) {
  _models.set(model.id, model);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function registerProvider(provider: ModelProvider): void {
  _providers.set(provider.name, provider);
}

export function getProvider(name: string): ModelProvider | undefined {
  return _providers.get(name);
}

export function listProviders(): ModelProvider[] {
  return Array.from(_providers.values());
}

export function getModel(id: string): ModelDefinition | undefined {
  return _models.get(id);
}

export function listModels(): ModelDefinition[] {
  return Array.from(_models.values());
}

export function getDefaultModel(): ModelDefinition {
  const model = Array.from(_models.values()).find(m => m.isDefault);
  if (!model) {
    throw new AiError({
      code: AiErrorCode.MODEL_NOT_FOUND,
      message: 'No default model configured',
      phase: 'model.registry',
    });
  }
  return model;
}

export function registerModel(model: ModelDefinition): void {
  _models.set(model.id, model);
}
