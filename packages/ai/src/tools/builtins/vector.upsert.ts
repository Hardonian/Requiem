/**
 * @fileoverview Tenant-isolated vector upsert tool.
 *
 * INVARIANT: tenant_id is MANDATORY — no fallback to global.
 * INVARIANT: Cross-tenant upserts are rejected at type + service level.
 * INVARIANT: Embedding model version stored per record.
 * INVARIANT: Input text hash stored for content deduplication.
 * INVARIANT: Vector dimensionality validated against expected model dimensions.
 */

import { createHash } from 'crypto';
import { registerTool } from '../registry';
import { getVectorStore } from '../../memory/vectorPointers';
import { AiError } from '../../errors/AiError';
import { AiErrorCode } from '../../errors/codes';
import { logger } from '../../telemetry/logger';
import { now } from '../../types/index';

/** Known embedding model dimensions */
const EMBEDDING_DIMENSIONS: Record<string, number> = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
  'cohere-embed-v3': 1024,
};

registerTool(
  {
    name: 'vector.upsert',
    version: '1.0.0',
    description: 'Upsert an embedding vector into the tenant-scoped vector store. Requires tenant context. Validates dimensionality.',
    deterministic: false, // Embeddings may vary by model version
    sideEffect: true,
    idempotent: true, // Same content + model = same embedding
    tenantScoped: true,
    requiredCapabilities: ['memory:write'],
    inputSchema: {
      type: 'object',
      required: ['content', 'embedding', 'embedding_model'],
      properties: {
        content: {
          type: 'string',
          description: 'Original text content being embedded',
          maxLength: 65_536,
        },
        embedding: {
          type: 'array',
          items: { type: 'number' },
          description: 'Embedding vector (float array)',
          minItems: 64,
          maxItems: 4096,
        },
        embedding_model: {
          type: 'string',
          description: 'Model used to produce this embedding',
          enum: Object.keys(EMBEDDING_DIMENSIONS),
        },
        metadata: {
          type: 'object',
          description: 'Optional metadata for the vector record',
          additionalProperties: true,
        },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      required: ['content_hash', 'dimensions', 'embedding_model'],
      properties: {
        content_hash: { type: 'string' },
        dimensions: { type: 'number' },
        embedding_model: { type: 'string' },
        tenant_id: { type: 'string' },
      },
    },
  },
  async (ctx, input) => {
    const { content, embedding, embedding_model } = input as {
      content: string;
      embedding: number[];
      embedding_model: string;
    };

    const tenantId = ctx.tenant.tenantId;

    // Validate dimensionality
    const expectedDims = EMBEDDING_DIMENSIONS[embedding_model];
    if (expectedDims !== undefined && embedding.length !== expectedDims) {
      throw new AiError({
        code: AiErrorCode.VECTOR_DIMENSION_MISMATCH,
        message: `Embedding dimension mismatch: model "${embedding_model}" expects ${expectedDims} dimensions, got ${embedding.length}`,
        phase: 'vector.upsert',
      });
    }

    // Validate all values are finite numbers
    for (let i = 0; i < embedding.length; i++) {
      if (!isFinite(embedding[i])) {
        throw new AiError({
          code: AiErrorCode.TOOL_SCHEMA_VIOLATION,
          message: `Embedding contains non-finite value at index ${i}`,
          phase: 'vector.upsert',
        });
      }
    }

    // Content hash for deduplication
    const contentHash = createHash('sha256').update(content, 'utf8').digest('hex');

    const store = getVectorStore();
    try {
      await store.upsert({
        contentHash,
        embedding,
        embeddingModel: embedding_model,
        tenantId,
        createdAt: now(),
      });
    } catch (err) {
      throw new AiError({
        code: AiErrorCode.VECTOR_STORE_FAILED,
        message: `Vector upsert failed: ${String(err)}`,
        phase: 'vector.upsert',
        cause: err,
      });
    }

    logger.debug('[vector.upsert] vector stored', {
      content_hash: contentHash,
      dimensions: embedding.length,
      model: embedding_model,
      tenant_id: tenantId,
    });

    return {
      content_hash: contentHash,
      dimensions: embedding.length,
      embedding_model,
      tenant_id: tenantId,
    };
  }
);
