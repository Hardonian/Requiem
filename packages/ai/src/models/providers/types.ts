/**
 * @fileoverview Provider adapter interface for AI model calls.
 *
 * All model providers MUST implement this interface.
 * This allows swapping providers without changing skill code.
 */

import type { InvocationContext } from '../../types/index.js';

// ─── Generation Request ───────────────────────────────────────────────────────

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GenerateTextRequest {
  messages?: Message[];
  prompt?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  /** JSON Schema for structured output (if supported by provider) */
  jsonSchema?: Record<string, unknown>;
  ctx: InvocationContext;
}

// ─── Generation Response ──────────────────────────────────────────────────────

export interface GenerateTextResponse {
  text: string;
  /** Structured JSON output (if jsonSchema was provided) */
  structured?: unknown;
  inputTokens: number;
  outputTokens: number;
  /** Cost in USD cents */
  costCents: number;
  latencyMs: number;
  provider: string;
  model: string;
}

// ─── Provider Interface ───────────────────────────────────────────────────────

export interface ModelProvider {
  readonly name: string;
  readonly supportedModels: readonly string[];

  /**
   * Generate text from a prompt or message list.
   * Must throw AiError on failure (never raw errors).
   */
  generateText(request: GenerateTextRequest): Promise<GenerateTextResponse>;

  /**
   * Check if the provider is available (health check).
   */
  isAvailable(): Promise<boolean>;
}
