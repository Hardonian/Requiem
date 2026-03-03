-- Migration: Test Data Foundry Tables
-- Description: Harden and extend the database layer to support a Test Data Foundry
-- with strict tenant isolation, idempotency, and deterministic replay.
-- Date: 2025-03-03

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- DATASETS TABLE
-- Stores dataset metadata with tenant isolation
-- =============================================================================
CREATE TABLE datasets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    stable_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    dataset_type TEXT NOT NULL DEFAULT 'test', -- test, train, validation, benchmark
    schema_json JSONB,
    item_count INTEGER NOT NULL DEFAULT 0,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    parent_dataset_id UUID,
    labels_enabled BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT NOT NULL,
    
    -- Composite unique constraint for idempotency
    CONSTRAINT uq_dataset_tenant_hash UNIQUE (tenant_id, stable_hash),
    -- Foreign key to parent dataset for versioning
    CONSTRAINT fk_dataset_parent FOREIGN KEY (parent_dataset_id) 
        REFERENCES datasets(id) ON DELETE SET NULL
);

-- Indexes for datasets
CREATE INDEX idx_datasets_tenant_id ON datasets(tenant_id);
CREATE INDEX idx_datasets_tenant_type ON datasets(tenant_id, dataset_type);
CREATE INDEX idx_datasets_created_at ON datasets(tenant_id, created_at DESC);
CREATE INDEX idx_datasets_stable_hash ON datasets(tenant_id, stable_hash);

-- =============================================================================
-- DATASET_ITEMS TABLE
-- Individual items within a dataset
-- =============================================================================
CREATE TABLE dataset_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    dataset_id UUID NOT NULL,
    stable_hash TEXT NOT NULL,
    item_index INTEGER NOT NULL,
    content JSONB NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'json',
    size_bytes INTEGER NOT NULL DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Composite unique constraint for idempotency
    CONSTRAINT uq_dataset_item_tenant_hash UNIQUE (tenant_id, stable_hash),
    -- Foreign key to dataset with cascade delete
    CONSTRAINT fk_dataset_item_dataset FOREIGN KEY (dataset_id) 
        REFERENCES datasets(id) ON DELETE CASCADE,
    -- Ensure item index is unique per dataset
    CONSTRAINT uq_dataset_item_index UNIQUE (dataset_id, item_index)
);

-- Indexes for dataset_items
CREATE INDEX idx_dataset_items_tenant_id ON dataset_items(tenant_id);
CREATE INDEX idx_dataset_items_dataset_id ON dataset_items(dataset_id);
CREATE INDEX idx_dataset_items_stable_hash ON dataset_items(tenant_id, stable_hash);

-- =============================================================================
-- LABELS TABLE
-- Labels for dataset items (classification, annotation, etc.)
-- =============================================================================
CREATE TABLE labels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    dataset_id UUID NOT NULL,
    dataset_item_id UUID NOT NULL,
    label_type TEXT NOT NULL DEFAULT 'manual', -- manual, auto, predicted, ground_truth
    label_key TEXT NOT NULL,
    label_value JSONB NOT NULL,
    confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
    labeled_by TEXT,
    source_generator_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Foreign keys
    CONSTRAINT fk_label_dataset FOREIGN KEY (dataset_id) 
        REFERENCES datasets(id) ON DELETE CASCADE,
    CONSTRAINT fk_label_dataset_item FOREIGN KEY (dataset_item_id) 
        REFERENCES dataset_items(id) ON DELETE CASCADE
);

-- Indexes for labels
CREATE INDEX idx_labels_tenant_id ON labels(tenant_id);
CREATE INDEX idx_labels_dataset_id ON labels(dataset_id);
CREATE INDEX idx_labels_dataset_item_id ON labels(dataset_item_id);
CREATE INDEX idx_labels_label_key ON labels(tenant_id, label_key);
CREATE INDEX idx_labels_type ON labels(tenant_id, label_type);

-- =============================================================================
-- GENERATORS TABLE
-- Configuration for data generators
-- =============================================================================
CREATE TABLE generators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    stable_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    generator_type TEXT NOT NULL, -- synthetic, augment, mutate, sample
    config_json JSONB NOT NULL,
    seed_value BIGINT,
    deterministic BOOLEAN NOT NULL DEFAULT true,
    version INTEGER NOT NULL DEFAULT 1,
    parent_generator_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT NOT NULL,
    
    -- Composite unique constraint for idempotency
    CONSTRAINT uq_generator_tenant_hash UNIQUE (tenant_id, stable_hash),
    -- Foreign key to parent generator for versioning
    CONSTRAINT fk_generator_parent FOREIGN KEY (parent_generator_id) 
        REFERENCES generators(id) ON DELETE SET NULL
);

-- Indexes for generators
CREATE INDEX idx_generators_tenant_id ON generators(tenant_id);
CREATE INDEX idx_generators_tenant_type ON generators(tenant_id, generator_type);
CREATE INDEX idx_generators_stable_hash ON generators(tenant_id, stable_hash);
CREATE INDEX idx_generators_created_at ON generators(tenant_id, created_at DESC);

-- =============================================================================
-- GENERATOR_RUNS TABLE
-- Execution records for generator runs
-- =============================================================================
CREATE TABLE generator_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    run_id TEXT NOT NULL UNIQUE,
    generator_id UUID NOT NULL,
    source_dataset_id UUID,
    output_dataset_id UUID,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
    config_snapshot JSONB NOT NULL,
    seed_value BIGINT,
    item_count INTEGER,
    duration_ms INTEGER,
    trace_id TEXT NOT NULL,
    error_message TEXT,
    error_code TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by TEXT NOT NULL,
    
    -- Foreign keys
    CONSTRAINT fk_genrun_generator FOREIGN KEY (generator_id) 
        REFERENCES generators(id) ON DELETE RESTRICT,
    CONSTRAINT fk_genrun_source_dataset FOREIGN KEY (source_dataset_id) 
        REFERENCES datasets(id) ON DELETE SET NULL,
    CONSTRAINT fk_genrun_output_dataset FOREIGN KEY (output_dataset_id) 
        REFERENCES datasets(id) ON DELETE SET NULL
);

-- Indexes for generator_runs
CREATE INDEX idx_generator_runs_tenant_id ON generator_runs(tenant_id);
CREATE INDEX idx_generator_runs_generator_id ON generator_runs(generator_id);
CREATE INDEX idx_generator_runs_status ON generator_runs(tenant_id, status);
CREATE INDEX idx_generator_runs_trace_id ON generator_runs(trace_id);
CREATE INDEX idx_generator_runs_created_at ON generator_runs(tenant_id, created_at DESC);
CREATE INDEX idx_generator_runs_output_dataset ON generator_runs(output_dataset_id);

-- =============================================================================
-- EVAL_RUNS TABLE
-- Evaluation runs for datasets against models/policies
-- =============================================================================
CREATE TABLE eval_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    run_id TEXT NOT NULL UNIQUE,
    dataset_id UUID NOT NULL,
    target_type TEXT NOT NULL, -- model, policy, skill, agent
    target_id TEXT NOT NULL,
    target_version TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
    metrics_json JSONB,
    score_summary JSONB,
    item_results_count INTEGER DEFAULT 0,
    duration_ms INTEGER,
    trace_id TEXT NOT NULL,
    error_message TEXT,
    error_code TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by TEXT NOT NULL,
    
    -- Foreign key to dataset
    CONSTRAINT fk_evalrun_dataset FOREIGN KEY (dataset_id) 
        REFERENCES datasets(id) ON DELETE CASCADE
);

-- Indexes for eval_runs
CREATE INDEX idx_eval_runs_tenant_id ON eval_runs(tenant_id);
CREATE INDEX idx_eval_runs_dataset_id ON eval_runs(dataset_id);
CREATE INDEX idx_eval_runs_status ON eval_runs(tenant_id, status);
CREATE INDEX idx_eval_runs_trace_id ON eval_runs(trace_id);
CREATE INDEX idx_eval_runs_target ON eval_runs(tenant_id, target_type, target_id);
CREATE INDEX idx_eval_runs_created_at ON eval_runs(tenant_id, created_at DESC);

-- =============================================================================
-- DRIFT_VECTORS TABLE
-- Drift detection vectors for datasets and runs
-- =============================================================================
CREATE TABLE drift_vectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    vector_name TEXT NOT NULL,
    vector_type TEXT NOT NULL, -- data_drift, concept_drift, prediction_drift, label_drift
    source_type TEXT NOT NULL, -- dataset, eval_run, generator_run
    source_id TEXT NOT NULL,
    baseline_dataset_id UUID,
    comparison_dataset_id UUID,
    drift_score FLOAT CHECK (drift_score >= 0 AND drift_score <= 1),
    threshold FLOAT NOT NULL DEFAULT 0.05,
    is_drift_detected BOOLEAN NOT NULL DEFAULT false,
    features_json JSONB,
    distribution_comparison JSONB,
    trace_id TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Foreign keys
    CONSTRAINT fk_drift_baseline_dataset FOREIGN KEY (baseline_dataset_id) 
        REFERENCES datasets(id) ON DELETE SET NULL,
    CONSTRAINT fk_drift_comparison_dataset FOREIGN KEY (comparison_dataset_id) 
        REFERENCES datasets(id) ON DELETE SET NULL
);

-- Indexes for drift_vectors
CREATE INDEX idx_drift_vectors_tenant_id ON drift_vectors(tenant_id);
CREATE INDEX idx_drift_vectors_source ON drift_vectors(tenant_id, source_type, source_id);
CREATE INDEX idx_drift_vectors_type ON drift_vectors(tenant_id, vector_type);
CREATE INDEX idx_drift_vectors_detected ON drift_vectors(tenant_id, is_drift_detected);
CREATE INDEX idx_drift_vectors_created_at ON drift_vectors(tenant_id, created_at DESC);

-- =============================================================================
-- RUN_ARTIFACTS TABLE
-- Artifacts produced by generator and evaluation runs
-- =============================================================================
CREATE TABLE run_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    run_type TEXT NOT NULL, -- generator_run, eval_run
    artifact_type TEXT NOT NULL, -- dataset, report, log, manifest, checkpoint
    artifact_name TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    mime_type TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Composite unique constraint for idempotency
    CONSTRAINT uq_artifact_tenant_run_name UNIQUE (tenant_id, run_id, artifact_name)
);

-- Indexes for run_artifacts
CREATE INDEX idx_run_artifacts_tenant_id ON run_artifacts(tenant_id);
CREATE INDEX idx_run_artifacts_run_id ON run_artifacts(run_id);
CREATE INDEX idx_run_artifacts_type ON run_artifacts(tenant_id, artifact_type);
CREATE INDEX idx_run_artifacts_content_hash ON run_artifacts(tenant_id, content_hash);
CREATE INDEX idx_run_artifacts_created_at ON run_artifacts(tenant_id, created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- Strict tenant isolation with least-privilege access
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE generators ENABLE ROW LEVEL SECURITY;
ALTER TABLE generator_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE eval_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_artifacts ENABLE ROW LEVEL SECURITY;

-- Create helper function to get current tenant ID from session
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        current_setting('app.current_tenant_id', true),
        current_setting('request.jwt.claims', true)::json->>'tenant_id',
        NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is tenant member
CREATE OR REPLACE FUNCTION is_tenant_member(p_tenant_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_tenant_id() = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- DATASETS RLS POLICIES
CREATE POLICY datasets_select_tenant ON datasets
    FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY datasets_insert_tenant ON datasets
    FOR INSERT WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY datasets_update_tenant ON datasets
    FOR UPDATE USING (is_tenant_member(tenant_id))
    WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY datasets_delete_tenant ON datasets
    FOR DELETE USING (is_tenant_member(tenant_id));

-- DATASET_ITEMS RLS POLICIES
CREATE POLICY dataset_items_select_tenant ON dataset_items
    FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY dataset_items_insert_tenant ON dataset_items
    FOR INSERT WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY dataset_items_update_tenant ON dataset_items
    FOR UPDATE USING (is_tenant_member(tenant_id))
    WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY dataset_items_delete_tenant ON dataset_items
    FOR DELETE USING (is_tenant_member(tenant_id));

-- LABELS RLS POLICIES
CREATE POLICY labels_select_tenant ON labels
    FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY labels_insert_tenant ON labels
    FOR INSERT WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY labels_update_tenant ON labels
    FOR UPDATE USING (is_tenant_member(tenant_id))
    WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY labels_delete_tenant ON labels
    FOR DELETE USING (is_tenant_member(tenant_id));

-- GENERATORS RLS POLICIES
CREATE POLICY generators_select_tenant ON generators
    FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY generators_insert_tenant ON generators
    FOR INSERT WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY generators_update_tenant ON generators
    FOR UPDATE USING (is_tenant_member(tenant_id))
    WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY generators_delete_tenant ON generators
    FOR DELETE USING (is_tenant_member(tenant_id));

-- GENERATOR_RUNS RLS POLICIES
CREATE POLICY generator_runs_select_tenant ON generator_runs
    FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY generator_runs_insert_tenant ON generator_runs
    FOR INSERT WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY generator_runs_update_tenant ON generator_runs
    FOR UPDATE USING (is_tenant_member(tenant_id))
    WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY generator_runs_delete_tenant ON generator_runs
    FOR DELETE USING (is_tenant_member(tenant_id));

-- EVAL_RUNS RLS POLICIES
CREATE POLICY eval_runs_select_tenant ON eval_runs
    FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY eval_runs_insert_tenant ON eval_runs
    FOR INSERT WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY eval_runs_update_tenant ON eval_runs
    FOR UPDATE USING (is_tenant_member(tenant_id))
    WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY eval_runs_delete_tenant ON eval_runs
    FOR DELETE USING (is_tenant_member(tenant_id));

-- DRIFT_VECTORS RLS POLICIES
CREATE POLICY drift_vectors_select_tenant ON drift_vectors
    FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY drift_vectors_insert_tenant ON drift_vectors
    FOR INSERT WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY drift_vectors_update_tenant ON drift_vectors
    FOR UPDATE USING (is_tenant_member(tenant_id))
    WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY drift_vectors_delete_tenant ON drift_vectors
    FOR DELETE USING (is_tenant_member(tenant_id));

-- RUN_ARTIFACTS RLS POLICIES
CREATE POLICY run_artifacts_select_tenant ON run_artifacts
    FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY run_artifacts_insert_tenant ON run_artifacts
    FOR INSERT WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY run_artifacts_update_tenant ON run_artifacts
    FOR UPDATE USING (is_tenant_member(tenant_id))
    WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY run_artifacts_delete_tenant ON run_artifacts
    FOR DELETE USING (is_tenant_member(tenant_id));

-- =============================================================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER datasets_updated_at BEFORE UPDATE ON datasets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER dataset_items_updated_at BEFORE UPDATE ON dataset_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER labels_updated_at BEFORE UPDATE ON labels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER generators_updated_at BEFORE UPDATE ON generators
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TRIGGER FOR DATASET ITEM COUNT SYNC
-- =============================================================================

CREATE OR REPLACE FUNCTION update_dataset_item_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE datasets 
        SET item_count = item_count + 1,
            size_bytes = size_bytes + NEW.size_bytes
        WHERE id = NEW.dataset_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE datasets 
        SET item_count = item_count - 1,
            size_bytes = size_bytes - OLD.size_bytes
        WHERE id = OLD.dataset_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dataset_items_count_sync AFTER INSERT OR DELETE ON dataset_items
    FOR EACH ROW EXECUTE FUNCTION update_dataset_item_count();

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE datasets IS 'Stores dataset metadata with tenant isolation and idempotency via stable_hash';
COMMENT ON TABLE dataset_items IS 'Individual items within a dataset, with content stored as JSONB';
COMMENT ON TABLE labels IS 'Labels/annotations for dataset items with support for multiple label types';
COMMENT ON TABLE generators IS 'Configuration for data generators with deterministic replay support';
COMMENT ON TABLE generator_runs IS 'Execution records for generator runs with full traceability';
COMMENT ON TABLE eval_runs IS 'Evaluation runs for datasets against models/policies/agents';
COMMENT ON TABLE drift_vectors IS 'Drift detection vectors for monitoring data/concept/label drift';
COMMENT ON TABLE run_artifacts IS 'Artifacts produced by generator and evaluation runs';
