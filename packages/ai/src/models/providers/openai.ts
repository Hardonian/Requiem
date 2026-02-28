/**
 * @fileoverview OpenAI provider adapter (scaffold).
 *
 * Returns AiError.PROVIDER_NOT_CONFIGURED when API key is absent.
 * To activate: set OPENAI_API_KEY environment variable.
 */

import { AiError } from '../../errors/AiError';
import { AiErrorCode } from '../../errors/codes';
import type { ModelProvider, GenerateTextRequest, GenerateTextResponse } from './types';

export class OpenAIProvider implements ModelProvider {
  readonly name = 'openai';
  readonly supportedModels = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
  ] as const;

  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
  }

  async generateText(req: GenerateTextRequest): Promise<GenerateTextResponse> {
    if (!this.apiKey) {
      throw AiError.providerNotConfigured('openai');
    }

    const startMs = Date.now();

    const messages = req.messages ?? [
      { role: 'user' as const, content: req.prompt ?? '' },
    ];

    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: req.maxTokens ?? 4096,
      messages,
    };

    if (req.jsonSchema) {
      body.response_format = {
        type: 'json_schema',
        json_schema: { name: 'output', schema: req.jsonSchema, strict: true },
      };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown error');
      if (response.status === 429) {
        throw new AiError({
          code: AiErrorCode.PROVIDER_RATE_LIMITED,
          message: `OpenAI rate limit: ${errText}`,
          retryable: true,
          phase: 'model.openai',
        });
      }
      throw new AiError({
        code: AiErrorCode.PROVIDER_UNAVAILABLE,
        message: `OpenAI API error (${response.status}): ${errText}`,
        retryable: response.status >= 500,
        phase: 'model.openai',
      });
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    const latencyMs = Date.now() - startMs;
    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;
    const text = data.choices?.[0]?.message?.content ?? '';

    let structured: unknown;
    if (req.jsonSchema) {
      try { structured = JSON.parse(text); } catch { /* not parseable */ }
    }

    const costCents = (inputTokens / 1_000_000 * 0.50 + outputTokens / 1_000_000 * 1.50) * 100;

    return { text, structured, inputTokens, outputTokens, costCents, latencyMs, provider: 'openai', model: req.model };
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey);
  }
}
