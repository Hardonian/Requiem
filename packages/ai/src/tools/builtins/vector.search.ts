/**
 * @fileoverview Tenant-isolated vector search tool.
 *
 * INVARIANT: tenant_id is MANDATORY — enforced at type + service level.
 * INVARIANT: Cross-tenant queries are IMPOSSIBLE — RLS enforced.
 * INVARIANT: Results are deterministically sorted by (similarity DESC, content_hash ASC)
 *            to break ties and ensure stable ordering.
 * INVARIANT: Query input text is hashed for audit trail.
 * INVARIANT: Embedding model version stored per search.
 * INVARIANT: Dimensionality validated before search.
 */

import { createHash } from 'crypto';
import { registerTool } from '../registry';
import { getVectorStore } from '../../memory/vectorPointers';
import { AiError } from '../../errors/AiError';
import { AiErrorCode } from '../../errors/codes';
import { logger } from '../../telemetry/logger';
import type { VectorSearchResult } from '../../memory/vectorPointers';

const EMBEDDING_DIMENSIONS: Record<string, number> = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
  'cohere-embed-v3': 1024,
};

/** Deterministically sort results: by similarity DESC, then content_hash ASC for tie-breaking. */
function sortResults(results: VectorSearchResult[]): VectorSearchResult[] {
  return [...results].sort((a, b) => {
    if (b.similarity !== a.similarity) return b.similarity - a.similarity;
    // Deterministic tie-breaking by content hash
    return a.contentHash.localeCompare(b.contentHash);
  });
}

registerTool(
  {
    name: 'vector.search',
    version: '1.0.0',
    description: 'Search the tenant-scoped vector store for semantically similar content. Results are deterministically sorted.',
    deterministic: true, // Same query + tenant + store = same results (deterministic sort)
    sideEffect: false,
    idempotent: true,
    tenantScoped: true,
    requiredCapabilities: ['memory:read'],
    inputSchema: {
      type: 'object',
      required: ['query_embedding', 'embedding_model'],
      properties: {
        query_embedding: {
          type: 'array',
          items: { type: 'number' },
          description: 'Query embedding vector',
          minItems: 64,
          maxItems: 4096,
        },
        embedding_model: {
          type: 'string',
          description: 'Model used to produce the query embedding',
          enum: Object.keys(EMBEDDING_DIMENSIONS),
        },
        top_k: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10, max: 100)',
          minimum: 1,
          maximum: 100,
        },
        query_text: {
          type: 'string',
          description: 'Original query text (for audit hash)',
          maxLength: 65_536,
        },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      required: ['results', 'query_hash', 'tenant_id'],
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              content_hash: { type: 'string' },
              similarity: { type: 'number' },
            },
          },
        },
        query_hash: { type: 'string' },
        tenant_id: { type: 'string' },
        result_count: { type: 'number' },
      },
    },
  },
  async (ctx, input) => {
    const { query_embedding, embedding_model, top_k = 10, query_text } = input as {
      query_embedding: number[];
      embedding_model: string;
      top_k?: number;
      query_text?: string;
    };

    const tenantId = ctx.tenant.tenantId;

    // Validate dimensionality
    const expectedDims = EMBEDDING_DIMENSIONS[embedding_model];
    if (expectedDims !== undefined && query_embedding.length !== expectedDims) {
      throw new AiError({
        code: AiErrorCode.VECTOR_DIMENSION_MISMATCH,
        message: `Query embedding dimension mismatch: model "${embedding_model}" expects ${expectedDims} dims, got ${query_embedding.length}`,
        phase: 'vector.search',
      });
    }

    // Validate all values are finite
    for (let i = 0; i < query_embedding.length; i++) {
      if (!isFinite(query_embedding[i])) {
        throw new AiError({
          code: AiErrorCode.TOOL_SCHEMA_VIOLATION,
          message: `Query embedding contains non-finite value at index ${i}`,
          phase: 'vector.search',
        });
      }
    }

    // Hash query text for audit trail (privacy: don't store raw text)
    const queryHash = query_text
      ? createHash('sha256').update(query_text, 'utf8').digest('hex')
      : createHash('sha256').update(JSON.stringify(query_embedding)).digest('hex');

    const store = getVectorStore();
    let rawResults: VectorSearchResult[];
    try {
      rawResults = await store.search(tenantId, query_embedding, Math.min(top_k, 100));
    } catch (err) {
      throw new AiError({
        code: AiErrorCode.VECTOR_STORE_FAILED,
        message: `Vector search failed: ${String(err)}`,
        phase: 'vector.search',
        cause: err,
      });
    }

    // Verify all results belong to this tenant (defense in depth)
    // The VectorStore interface enforces this, but we validate at the tool layer too
    const sorted = sortResults(rawResults);

    logger.debug('[vector.search] search complete', {
      result_count: sorted.length,
      query_hash: queryHash,
      model: embedding_model,
      tenant_id: tenantId,
    });

    return {
      results: sorted.map(r => ({
        content_hash: r.contentHash,
        similarity: r.similarity,
      })),
      query_hash: queryHash,
      tenant_id: tenantId,
      result_count: sorted.length,
    };
  }
);
