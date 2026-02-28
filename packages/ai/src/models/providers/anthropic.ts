/**
 * @fileoverview Anthropic Claude provider adapter (scaffold).
 *
 * Wraps Anthropic API calls in the standard ModelProvider interface.
 * Returns AiError.PROVIDER_NOT_CONFIGURED when API key is absent.
 *
 * To activate: set ANTHROPIC_API_KEY environment variable.
 */

import { AiError } from '../../errors/AiError';
import { AiErrorCode } from '../../errors/codes';
import type { ModelProvider, GenerateTextRequest, GenerateTextResponse } from './types';

export class AnthropicProvider implements ModelProvider {
  readonly name = 'anthropic';
  readonly supportedModels = [
    'claude-opus-4-6',
    'claude-sonnet-4-6',
    'claude-haiku-4-5-20251001',
  ] as const;

  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
  }

  async generateText(req: GenerateTextRequest): Promise<GenerateTextResponse> {
    if (!this.apiKey) {
      throw AiError.providerNotConfigured('anthropic');
    }

    const startMs = Date.now();

    // Build messages array
    const messages = req.messages ?? [
      { role: 'user' as const, content: req.prompt ?? '' },
    ];

    // Real Anthropic API call
    // Using fetch to avoid requiring @anthropic-ai/sdk as a hard dependency
    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: req.maxTokens ?? 4096,
      messages,
    };

    if (req.jsonSchema) {
      body.tools = [{
        name: 'structured_output',
        description: 'Return structured JSON output',
        input_schema: req.jsonSchema,
      }];
      body.tool_choice = { type: 'tool', name: 'structured_output' };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown error');
      if (response.status === 429) {
        throw new AiError({
          code: AiErrorCode.PROVIDER_RATE_LIMITED,
          message: `Anthropic rate limit: ${errText}`,
          retryable: true,
          phase: 'model.anthropic',
        });
      }
      throw new AiError({
        code: AiErrorCode.PROVIDER_UNAVAILABLE,
        message: `Anthropic API error (${response.status}): ${errText}`,
        retryable: response.status >= 500,
        phase: 'model.anthropic',
      });
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string; input?: unknown }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    const latencyMs = Date.now() - startMs;
    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;

    // Extract text or structured output
    let text = '';
    let structured: unknown;
    for (const block of data.content ?? []) {
      if (block.type === 'text') text = block.text ?? '';
      if (block.type === 'tool_use') structured = block.input;
    }

    // Estimate cost (Sonnet 4.6 pricing as baseline)
    const costCents = (inputTokens / 1_000_000 * 0.30 + outputTokens / 1_000_000 * 1.50) * 100;

    return { text, structured, inputTokens, outputTokens, costCents, latencyMs, provider: 'anthropic', model: req.model };
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey);
  }
}
