/**
 * @fileoverview Vector pointer types for optional vector index integration.
 *
 * Vectors are INDEX ONLY — they are pointers to canonical memory items.
 * The source of truth is always the canonical content store.
 *
 * This module provides types + a stub interface.
 * To integrate a real vector store (Supabase pgvector, Pinecone, etc.),
 * implement the VectorStore interface and call setVectorStore().
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VectorPointer {
  /** SHA-256 hash of the canonical content (links to MemoryItem) */
  contentHash: string;
  /** The embedding vector (dimension depends on model) */
  embedding: number[];
  /** Embedding model used */
  embeddingModel: string;
  /** Tenant ID (for isolation) */
  tenantId: string;
  /** When the vector was created */
  createdAt: string;
}

export interface VectorSearchResult {
  contentHash: string;
  similarity: number;
}

// ─── Vector Store Interface ───────────────────────────────────────────────────

export interface VectorStore {
  /** Store a vector pointer */
  upsert(pointer: VectorPointer): Promise<void>;
  /** Search for similar vectors by query embedding */
  search(tenantId: string, queryEmbedding: number[], topK?: number): Promise<VectorSearchResult[]>;
  /** Delete all vectors for a content hash */
  delete(tenantId: string, contentHash: string): Promise<void>;
}

// ─── Stub (No-Op) Implementation ─────────────────────────────────────────────

class StubVectorStore implements VectorStore {
  async upsert(_pointer: VectorPointer): Promise<void> {
    // No-op: vector store not configured
  }

  async search(_tenantId: string, _queryEmbedding: number[], _topK?: number): Promise<VectorSearchResult[]> {
    // No-op: return empty results
    return [];
  }

  async delete(_tenantId: string, _contentHash: string): Promise<void> {
    // No-op
  }
}

let _vectorStore: VectorStore = new StubVectorStore();

export function setVectorStore(store: VectorStore): void {
  _vectorStore = store;
}

export function getVectorStore(): VectorStore {
  return _vectorStore;
}
