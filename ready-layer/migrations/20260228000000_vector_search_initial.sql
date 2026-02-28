-- ready-layer/migrations/20260228000000_vector_search_initial.sql
--
-- Vector Search Subsystem Initial Migration
--
-- This migration creates the foundational tables and indexes for the vector search
-- subsystem including tenant management, document storage, embeddings, and query logging.
--
-- Dependencies: pgvector extension
-- Run order: This should be run after any existing migrations

-- ============================================================================
-- Enable pgvector extension
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- Tenants table (base tenant model since none exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text UNIQUE NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for tenant slug lookups
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- ============================================================================
-- Tenant members table
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id uuid NOT NULL, -- auth.users.id
    role text NOT NULL DEFAULT 'member', -- 'owner', 'member', 'viewer'
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, user_id)
);

-- Index for tenant member lookups
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_id ON tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user_id ON tenant_members(user_id);

-- ============================================================================
-- Vector documents table (canonical truth)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vector_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    source_type text NOT NULL,
    source_id uuid NULL,
    title text NULL,
    content text NOT NULL,
    content_hash text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}',
    created_by uuid NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_source UNIQUE(tenant_id, source_type, source_id)
);

-- Partial unique constraint for content hash (only when source_id is not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_vector_documents_content_hash 
    ON vector_documents(tenant_id, source_type, content_hash) 
    WHERE source_id IS NOT NULL;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_vector_documents_tenant_id ON vector_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vector_documents_source_type ON vector_documents(source_type);
CREATE INDEX IF NOT EXISTS idx_vector_documents_created_at ON vector_documents(created_at DESC);

-- ============================================================================
-- Vector embeddings table (index only)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vector_embeddings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    document_id uuid NOT NULL REFERENCES vector_documents(id) ON DELETE CASCADE,
    index_key text NOT NULL,
    chunk_index int NOT NULL DEFAULT 0,
    model text NOT NULL,
    model_version text NOT NULL,
    index_version int NOT NULL DEFAULT 1,
    embedding vector(1536) NOT NULL, -- dimension for text-embedding-3-small
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_embedding UNIQUE(
        tenant_id, 
        document_id, 
        index_key, 
        chunk_index, 
        model, 
        model_version, 
        index_version
    )
);

-- Indexes for embedding queries
CREATE INDEX IF NOT EXISTS idx_vector_embeddings_tenant_id ON vector_embeddings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vector_embeddings_document_id ON vector_embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_vector_embeddings_index_key ON vector_embeddings(index_key);

-- HNSW index on embeddings for fast vector similarity search
-- Using cosine distance (vector_cosine_ops) which is ideal for text embeddings
CREATE INDEX IF NOT EXISTS idx_vector_embeddings_hnsw 
    ON vector_embeddings 
    USING hnsw (embedding vector_cosine_ops) 
    WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- Vector queries log table (observability)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vector_queries_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    query_text text NOT NULL,
    returned_doc_ids uuid[] NOT NULL,
    latency_ms int NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for query log analysis
CREATE INDEX IF NOT EXISTS idx_vector_queries_log_tenant_id ON vector_queries_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vector_queries_log_actor_user_id ON vector_queries_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_vector_queries_log_created_at ON vector_queries_log(created_at DESC);

-- ============================================================================
-- Row Level Security (RLS) - MANDATORY on all tables
-- ============================================================================

-- Enable RLS on tenants table
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Tenants are publicly readable but only insertable by authenticated users
-- (In Supabase, you'd tie this to auth.users - here we use a policy approach)
CREATE POLICY "Tenants are viewable by authenticated users" 
    ON tenants FOR SELECT 
    TO authenticated
    USING (true);

CREATE POLICY "Tenants are insertable by authenticated users" 
    ON tenants FOR INSERT 
    TO authenticated
    WITH CHECK (true);

-- Enable RLS on tenant_members table
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;

-- Members can view other members in their tenant
CREATE POLICY "Tenant members are viewable by members" 
    ON tenant_members FOR SELECT 
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id 
            FROM tenant_members 
            WHERE user_id = auth.uid()
        )
    );

-- Members can be inserted by tenant owners/members
CREATE POLICY "Tenant members are insertable by members" 
    ON tenant_members FOR INSERT 
    TO authenticated
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id 
            FROM tenant_members 
            WHERE user_id = auth.uid()
        )
    );

-- Enable RLS on vector_documents table
ALTER TABLE vector_documents ENABLE ROW LEVEL SECURITY;

-- Documents viewable by tenant members
CREATE POLICY "Documents are viewable by tenant members" 
    ON vector_documents FOR SELECT 
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id 
            FROM tenant_members 
            WHERE user_id = auth.uid()
        )
    );

-- Documents insertable by tenant members
CREATE POLICY "Documents are insertable by tenant members" 
    ON vector_documents FOR INSERT 
    TO authenticated
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id 
            FROM tenant_members 
            WHERE user_id = auth.uid()
        )
    );

-- Documents updatable by tenant members
CREATE POLICY "Documents are updatable by tenant members" 
    ON vector_documents FOR UPDATE 
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id 
            FROM tenant_members 
            WHERE user_id = auth.uid()
        )
    );

-- Documents deletable by tenant members
CREATE POLICY "Documents are deletable by tenant members" 
    ON vector_documents FOR DELETE 
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id 
            FROM tenant_members 
            WHERE user_id = auth.uid()
        )
    );

-- Enable RLS on vector_embeddings table
ALTER TABLE vector_embeddings ENABLE ROW LEVEL SECURITY;

-- Embeddings viewable by tenant members
CREATE POLICY "Embeddings are viewable by tenant members" 
    ON vector_embeddings FOR SELECT 
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id 
            FROM tenant_members 
            WHERE user_id = auth.uid()
        )
    );

-- Embeddings insertable by tenant members
CREATE POLICY "Embeddings are insertable by tenant members" 
    ON vector_embeddings FOR INSERT 
    TO authenticated
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id 
            FROM tenant_members 
            WHERE user_id = auth.uid()
        )
    );

-- Embeddings deletable by tenant members
CREATE POLICY "Embeddings are deletable by tenant members" 
    ON vector_embeddings FOR DELETE 
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id 
            FROM tenant_members 
            WHERE user_id = auth.uid()
        )
    );

-- Enable RLS on vector_queries_log table
ALTER TABLE vector_queries_log ENABLE ROW LEVEL SECURITY;

-- Query logs viewable by tenant members
CREATE POLICY "Query logs are viewable by tenant members" 
    ON vector_queries_log FOR SELECT 
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id 
            FROM tenant_members 
            WHERE user_id = auth.uid()
        )
    );

-- Query logs insertable by tenant members
CREATE POLICY "Query logs are insertable by tenant members" 
    ON vector_queries_log FOR INSERT 
    TO authenticated
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id 
            FROM tenant_members 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- Helper functions for tenant membership
-- ============================================================================

-- Function to check if a user is a member of a tenant
CREATE OR REPLACE FUNCTION is_tenant_member(p_tenant_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS(
        SELECT 1 
        FROM tenant_members 
        WHERE tenant_id = p_tenant_id 
          AND user_id = p_user_id
    );
$$;

-- Function to check if a user is an owner of a tenant
CREATE OR REPLACE FUNCTION is_tenant_owner(p_tenant_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS(
        SELECT 1 
        FROM tenant_members 
        WHERE tenant_id = p_tenant_id 
          AND user_id = p_user_id
          AND role = 'owner'
    );
$$;

-- Function to get user's role in a tenant
CREATE OR REPLACE FUNCTION get_tenant_role(p_tenant_id uuid, p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT role 
    FROM tenant_members 
    WHERE tenant_id = p_tenant_id 
      AND user_id = p_user_id;
$$;

-- Function to get all tenant IDs for a user
CREATE OR REPLACE FUNCTION get_user_tenant_ids(p_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
AS $$
    SELECT ARRAY_AGG(tenant_id) 
    FROM tenant_members 
    WHERE user_id = p_user_id;
$$;

-- ============================================================================
-- RPC function for vector search
-- ============================================================================

-- Function to perform vector search with similarity threshold
CREATE OR REPLACE FUNCTION vector_search(
    p_tenant_id uuid,
    p_query_embedding vector(1536),
    p_index_key text,
    p_limit int DEFAULT 10,
    p_min_similarity float DEFAULT 0.7
)
RETURNS TABLE (
    document_id uuid,
    document_title text,
    document_content text,
    document_source_type text,
    document_source_id uuid,
    document_metadata jsonb,
    chunk_index int,
    similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vd.id AS document_id,
        vd.title AS document_title,
        vd.content AS document_content,
        vd.source_type AS document_source_type,
        vd.source_id AS document_source_id,
        ve.metadata AS document_metadata,
        ve.chunk_index,
        (ve.embedding <=> p_query_embedding) AS similarity
    FROM vector_embeddings ve
    INNER JOIN vector_documents vd ON ve.document_id = vd.id
    WHERE ve.tenant_id = p_tenant_id
      AND ve.index_key = p_index_key
      AND (ve.embedding <=> p_query_embedding) >= p_min_similarity
    ORDER BY ve.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$;

-- Function to search documents by text content (fallback when embedding not available)
CREATE OR REPLACE FUNCTION search_documents_text(
    p_tenant_id uuid,
    p_search_text text,
    p_source_type text DEFAULT NULL,
    p_limit int DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    source_type text,
    source_id uuid,
    title text,
    content text,
    metadata jsonb,
    created_at timestamptz
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vd.id,
        vd.source_type,
        vd.source_id,
        vd.title,
        vd.content,
        vd.metadata,
        vd.created_at
    FROM vector_documents vd
    WHERE vd.tenant_id = p_tenant_id
      AND (
          vd.title ILIKE '%' || p_search_text || '%'
          OR vd.content ILIKE '%' || p_search_text || '%'
      )
      AND (p_source_type IS NULL OR vd.source_type = p_source_type)
    ORDER BY vd.created_at DESC
    LIMIT p_limit;
END;
$$;

-- Function to log vector queries for observability
CREATE OR REPLACE FUNCTION log_vector_query(
    p_tenant_id uuid,
    p_actor_user_id uuid,
    p_query_text text,
    p_returned_doc_ids uuid[],
    p_latency_ms int
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
    INSERT INTO vector_queries_log (
        tenant_id,
        actor_user_id,
        query_text,
        returned_doc_ids,
        latency_ms
    ) VALUES (
        p_tenant_id,
        p_actor_user_id,
        p_query_text,
        p_returned_doc_ids,
        p_latency_ms
    );
END;
$$;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON EXTENSION vector IS 'Enables vector similarity search for embeddings';

COMMENT ON TABLE tenants IS 'Tenant registry for multi-tenant isolation';
COMMENT ON TABLE tenant_members IS 'Membership relationships between users and tenants';
COMMENT ON TABLE vector_documents IS 'Canonical document storage for vector search';
COMMENT ON TABLE vector_embeddings IS 'Vector embeddings indexed for similarity search';
COMMENT ON TABLE vector_queries_log IS 'Audit log for vector query observability';

COMMENT ON FUNCTION vector_search IS 'Performs cosine similarity search on embeddings within a tenant';
COMMENT ON FUNCTION search_documents_text IS 'Full-text search fallback for documents';
COMMENT ON FUNCTION log_vector_query IS 'Records vector query execution for observability';
COMMENT ON FUNCTION is_tenant_member IS 'Checks if a user is a member of a tenant';
COMMENT ON FUNCTION is_tenant_owner IS 'Checks if a user is an owner of a tenant';
