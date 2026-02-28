// ready-layer/src/lib/vector-search.ts
//
// BOUNDARY CONTRACT: Vector Search subsystem for Requiem
//
// This module provides:
// - Supabase client for database operations
// - Typed RPC client for vector_search function
// - Graceful degradation if tables don't exist
// - Interface for embedding generation (stubbed)
//
// EXTENSION_POINT: embedding_provider
//   Current: Stub implementation that returns zero vectors
//   Upgrade path:
//     a) OpenAI: integrate with text-embedding-3-small/ada-002
//     b) Cohere: integrate with embed-multilingual-v3.0
//     c) Custom: self-hosted embedding model

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, getSupabaseUrl, getSupabaseAnonKey } from './env';

// ============================================================================
// Types
// ============================================================================

/** Vector search result from the database */
export interface VectorSearchResult {
  document_id: string;
  document_title: string | null;
  document_content: string;
  document_source_type: string;
  document_source_id: string | null;
  document_metadata: Record<string, unknown>;
  chunk_index: number;
  similarity: number;
}

/** Text search result (fallback) */
export interface TextSearchResult {
  id: string;
  source_type: string;
  source_id: string | null;
  title: string | null;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Parameters for vector search */
export interface VectorSearchParams {
  tenant_id: string;
  query_embedding: number[];
  index_key: string;
  limit?: number;
  min_similarity?: number;
}

/** Parameters for text search */
export interface TextSearchParams {
  tenant_id: string;
  search_text: string;
  source_type?: string;
  limit?: number;
}

/** Parameters for document indexing */
export interface IndexDocumentParams {
  tenant_id: string;
  source_type: string;
  source_id?: string;
  title?: string;
  content: string;
  metadata?: Record<string, unknown>;
  index_key?: string;
  created_by?: string;
}

/** Parameters for embedding generation */
export interface GenerateEmbeddingParams {
  text: string;
  model?: string;
}

/** Vector search configuration */
export interface VectorSearchConfig {
  index_key: string;
  model: string;
  model_version: string;
  dimension: number;
  min_similarity: number;
  default_limit: number;
}

// Default configuration for vector search
export const DEFAULT_VECTOR_SEARCH_CONFIG: VectorSearchConfig = {
  index_key: 'default',
  model: 'text-embedding-3-small',
  model_version: '1.0',
  dimension: 1536,
  min_similarity: 0.7,
  default_limit: 10,
};

// ============================================================================
// Client Management
// ============================================================================

// Lazy-initialized Supabase client
let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create the Supabase client
 * 
 * @returns Supabase client or null if not configured
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    console.warn('[vector-search] Supabase not configured. Vector search unavailable.');
    return null;
  }

  if (!supabaseClient) {
    const supabaseUrl = getSupabaseUrl();
    const supabaseKey = getSupabaseAnonKey();

    if (!supabaseUrl || !supabaseKey) {
      console.warn('[vector-search] Missing Supabase URL or anon key.');
      return null;
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseClient;
}

/**
 * Check if vector search is available
 * 
 * @returns true if the vector search subsystem is configured
 */
export function isVectorSearchAvailable(): boolean {
  return getSupabaseClient() !== null;
}

// ============================================================================
// Embedding Generation (EXTENSION_POINT)
// ============================================================================

/**
 * Generate embeddings for text
 * 
 * EXTENSION_POINT: embedding_provider
 * This is a stub implementation that returns a zero vector.
 * Replace with actual embedding provider integration.
 * 
 * @param params - Text and model parameters
 * @returns Embedding vector
 */
export async function generateEmbedding(
  params: GenerateEmbeddingParams,
): Promise<number[]> {
  // STUB: Return zero vector (replace with actual embedding provider)
  // 
  // Upgrade paths:
  // 1. OpenAI: const response = await openai.embeddings.create({...})
  // 2. Cohere: const response = await cohere.embed({...})
  // 3. Self-hosted: Call internal embedding service

  const dimension = DEFAULT_VECTOR_SEARCH_CONFIG.dimension;
  
  console.warn(
    `[vector-search] generateEmbedding is stubbed. ` +
    `Returning zero vector of dimension ${dimension}. ` +
    `Text: "${params.text.slice(0, 50)}..."`
  );

  // Return zero vector of appropriate dimension
  return Array(dimension).fill(0);
}

/**
 * Generate embeddings for multiple texts
 * 
 * @param texts - Array of texts to embed
 * @param model - Model to use (optional)
 * @returns Array of embedding vectors
 */
export async function generateEmbeddings(
  texts: string[],
  model?: string,
): Promise<number[][]> {
  // Process in parallel
  const embeddings = await Promise.all(
    texts.map(text => generateEmbedding({ text, model }))
  );
  return embeddings;
}

// ============================================================================
// Vector Search Operations
// ============================================================================

/**
 * Perform vector similarity search
 * 
 * @param params - Search parameters
 * @returns Array of search results with similarity scores
 */
export async function vectorSearch(
  params: VectorSearchParams,
): Promise<VectorSearchResult[]> {
  const client = getSupabaseClient();
  if (!client) {
    return [];
  }

  const { tenant_id, query_embedding, index_key, limit = 10, min_similarity = 0.7 } = params;

  try {
    // Call the RPC function for vector search
    const { data, error } = await client.rpc('vector_search', {
      p_tenant_id: tenant_id,
      p_query_embedding: query_embedding,
      p_index_key: index_key,
      p_limit: limit,
      p_min_similarity: min_similarity,
    });

    if (error) {
      // Check if it's a "function not found" error (tables don't exist)
      if (error.message?.includes('function') && error.message?.includes('does not exist')) {
        console.warn('[vector-search] Vector search tables not initialized. Run migration first.');
        return [];
      }
      console.error('[vector-search] Vector search error:', error);
      throw error;
    }

    return data ?? [];
  } catch (err) {
    console.error('[vector-search] Failed to execute vector search:', err);
    return [];
  }
}

/**
 * Perform text-based search (fallback when vector search unavailable)
 * 
 * @param params - Search parameters
 * @returns Array of text search results
 */
export async function textSearch(
  params: TextSearchParams,
): Promise<TextSearchResult[]> {
  const client = getSupabaseClient();
  if (!client) {
    return [];
  }

  const { tenant_id, search_text, source_type, limit = 10 } = params;

  try {
    // Call the RPC function for text search
    const { data, error } = await client.rpc('search_documents_text', {
      p_tenant_id: tenant_id,
      p_search_text: search_text,
      p_source_type: source_type ?? null,
      p_limit: limit,
    });

    if (error) {
      // Check if it's a "function not found" error (tables don't exist)
      if (error.message?.includes('function') && error.message?.includes('does not exist')) {
        console.warn('[vector-search] Search tables not initialized. Run migration first.');
        return [];
      }
      console.error('[vector-search] Text search error:', error);
      throw error;
    }

    return data ?? [];
  } catch (err) {
    console.error('[vector-search] Failed to execute text search:', err);
    return [];
  }
}

/**
 * Search with automatic fallback from vector to text search
 * 
 * @param params - Search parameters
 * @param preferVector - Whether to try vector search first (default: true)
 * @returns Search results
 */
export async function hybridSearch(
  params: TextSearchParams & { query_embedding?: number[] },
  preferVector = true,
): Promise<VectorSearchResult[] | TextSearchResult[]> {
  // If we have embeddings and prefer vector search, try that first
  if (preferVector && params.query_embedding) {
    const vectorResults = await vectorSearch({
      tenant_id: params.tenant_id,
      query_embedding: params.query_embedding,
      index_key: DEFAULT_VECTOR_SEARCH_CONFIG.index_key,
      limit: params.limit,
      min_similarity: DEFAULT_VECTOR_SEARCH_CONFIG.min_similarity,
    });

    // If vector search returned results, use them
    if (vectorResults.length > 0) {
      return vectorResults;
    }
  }

  // Fallback to text search
  return textSearch({
    tenant_id: params.tenant_id,
    search_text: params.search_text,
    source_type: params.source_type,
    limit: params.limit,
  });
}

// ============================================================================
// Document Indexing
// ============================================================================

/**
 * Index a document for vector search
 * 
 * This function:
 * 1. Creates the document record
 * 2. Generates embeddings for the content
 * 3. Stores embeddings in the vector_embeddings table
 * 
 * @param params - Document parameters
 * @returns Created document ID or null on failure
 */
export async function indexDocument(
  params: IndexDocumentParams,
): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) {
    console.warn('[vector-search] Cannot index document: Supabase not configured');
    return null;
  }

  const { tenant_id, source_type, source_id, title, content, metadata = {}, index_key, created_by } = params;

  try {
    // Calculate content hash for deduplication
    const contentHash = await calculateContentHash(content);

    // Insert document (upsert to handle duplicates)
    const { data: docData, error: docError } = await client
      .from('vector_documents')
      .upsert({
        tenant_id,
        source_type,
        source_id,
        title,
        content,
        content_hash: contentHash,
        metadata,
        created_by,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,source_type,source_id',
        ignoreDuplicates: true,
      })
      .select('id')
      .single();

    if (docError) {
      // Check if table doesn't exist
      if (docError.message?.includes('does not exist')) {
        console.warn('[vector-search] Documents table not initialized. Run migration first.');
        return null;
      }
      console.error('[vector-search] Failed to create document:', docError);
      return null;
    }

    const documentId = docData?.id;
    if (!documentId) {
      console.error('[vector-search] Document ID not returned');
      return null;
    }

    // Generate embedding for content
    const embedding = await generateEmbedding({
      text: content,
      model: DEFAULT_VECTOR_SEARCH_CONFIG.model,
    });

    // Insert embedding
    const { error: embError } = await client
      .from('vector_embeddings')
      .upsert({
        tenant_id,
        document_id: documentId,
        index_key: index_key ?? DEFAULT_VECTOR_SEARCH_CONFIG.index_key,
        chunk_index: 0,
        model: DEFAULT_VECTOR_SEARCH_CONFIG.model,
        model_version: DEFAULT_VECTOR_SEARCH_CONFIG.model_version,
        index_version: 1,
        embedding,
      }, {
        onConflict: 'tenant_id,document_id,index_key,chunk_index,model,model_version,index_version',
      });

    if (embError) {
      // Check if table doesn't exist
      if (embError.message?.includes('does not exist')) {
        console.warn('[vector-search] Embeddings table not initialized. Run migration first.');
        return documentId; // Document was created, but embeddings failed
      }
      console.error('[vector-search] Failed to create embedding:', embError);
      return documentId; // Document was created, but embedding failed
    }

    return documentId;
  } catch (err) {
    console.error('[vector-search] Failed to index document:', err);
    return null;
  }
}

/**
 * Delete a document and its embeddings
 * 
 * @param tenant_id - Tenant ID
 * @param document_id - Document ID to delete
 * @returns True if successful
 */
export async function deleteDocument(
  tenant_id: string,
  document_id: string,
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) {
    return false;
  }

  try {
    // Deleting the document will cascade delete embeddings due to FK constraint
    const { error } = await client
      .from('vector_documents')
      .delete()
      .match({ id: document_id, tenant_id });

    if (error) {
      console.error('[vector-search] Failed to delete document:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[vector-search] Failed to delete document:', err);
    return false;
  }
}

// ============================================================================
// Query Logging
// ============================================================================

/**
 * Log a vector query for observability
 * 
 * @param tenant_id - Tenant ID
 * @param actor_user_id - User performing the search
 * @param query_text - Search query text
 * @param returned_doc_ids - IDs of returned documents
 * @param latency_ms - Query latency in milliseconds
 */
export async function logQuery(
  tenant_id: string,
  actor_user_id: string,
  query_text: string,
  returned_doc_ids: string[],
  latency_ms: number,
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    return;
  }

  try {
    await client.rpc('log_vector_query', {
      p_tenant_id: tenant_id,
      p_actor_user_id: actor_user_id,
      p_query_text: query_text,
      p_returned_doc_ids: returned_doc_ids,
      p_latency_ms: latency_ms,
    });
  } catch (err) {
    // Silently fail - query logging should not block search results
    console.warn('[vector-search] Failed to log query:', err);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate SHA-256 hash of content for deduplication
 * 
 * @param content - Content to hash
 * @returns Hex-encoded hash string
 */
async function calculateContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Normalize embedding vector to unit length (for cosine similarity)
 * 
 * @param embedding - Raw embedding vector
 * @returns Normalized embedding vector
 */
export function normalizeEmbedding(embedding: number[]): number[] {
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return embedding;
  return embedding.map(val => val / magnitude);
}
