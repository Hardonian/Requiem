-- ready-layer/migrations/20260303093000_repo_lineage_ingest.sql
--
-- Repository lineage ingestion tables for deterministic public graph loading.
--
-- Tables:
--   - repos
--   - edges
--   - evidence
--   - ingest_runs
--
-- Design notes:
--   - tenant_id is mandatory on every table.
--   - stable_hash is the idempotent upsert key for repos/edges/evidence.
--   - run_id is the idempotent key for ingest_runs.

CREATE OR REPLACE FUNCTION public.current_tenant_id_text()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() ->> 'tenant_id', ''),
    NULLIF(current_setting('app.current_tenant', true), '')
  );
$$;

CREATE TABLE IF NOT EXISTS repos (
  stable_hash text PRIMARY KEY,
  tenant_id text NOT NULL,
  repo_full_name text NOT NULL,
  repo_owner text NOT NULL,
  repo_name text NOT NULL,
  is_scanned boolean NOT NULL DEFAULT false,
  is_fork boolean NOT NULL DEFAULT false,
  parent_full_name text NULL,
  source_full_name text NULL,
  html_url text NULL,
  default_branch text NULL,
  visibility text NULL,
  topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_run_id text NULL,
  last_seen_run_id text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, repo_full_name)
);

CREATE TABLE IF NOT EXISTS edges (
  stable_hash text PRIMARY KEY,
  tenant_id text NOT NULL,
  source_repo_full_name text NOT NULL,
  target_repo_full_name text NOT NULL,
  edge_type text NOT NULL,
  evidence_count integer NOT NULL DEFAULT 1,
  first_seen_run_id text NULL,
  last_seen_run_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source_repo_full_name, target_repo_full_name, edge_type)
);

CREATE TABLE IF NOT EXISTS evidence (
  stable_hash text PRIMARY KEY,
  edge_stable_hash text NOT NULL,
  tenant_id text NOT NULL,
  source_repo_full_name text NOT NULL,
  target_repo_full_name text NOT NULL,
  evidence_type text NOT NULL,
  evidence_value text NOT NULL,
  location text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingest_runs (
  run_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  owner_login text NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  artifact_dir text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  manifest_hash text NULL,
  error_message text NULL
);

CREATE INDEX IF NOT EXISTS idx_repos_tenant_repo ON repos (tenant_id, repo_full_name);
CREATE INDEX IF NOT EXISTS idx_edges_tenant_source ON edges (tenant_id, source_repo_full_name);
CREATE INDEX IF NOT EXISTS idx_edges_tenant_target ON edges (tenant_id, target_repo_full_name);
CREATE INDEX IF NOT EXISTS idx_evidence_tenant_source ON evidence (tenant_id, source_repo_full_name);
CREATE INDEX IF NOT EXISTS idx_evidence_tenant_target ON evidence (tenant_id, target_repo_full_name);
CREATE INDEX IF NOT EXISTS idx_evidence_edge_hash ON evidence (edge_stable_hash);
CREATE INDEX IF NOT EXISTS idx_ingest_runs_tenant_started ON ingest_runs (tenant_id, started_at DESC);

ALTER TABLE repos ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'repos' AND policyname = 'repos_tenant_select'
  ) THEN
    CREATE POLICY repos_tenant_select ON repos
      FOR SELECT TO authenticated
      USING (tenant_id = public.current_tenant_id_text());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'repos' AND policyname = 'repos_tenant_write'
  ) THEN
    CREATE POLICY repos_tenant_write ON repos
      FOR ALL TO authenticated
      USING (tenant_id = public.current_tenant_id_text())
      WITH CHECK (tenant_id = public.current_tenant_id_text());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'edges' AND policyname = 'edges_tenant_select'
  ) THEN
    CREATE POLICY edges_tenant_select ON edges
      FOR SELECT TO authenticated
      USING (tenant_id = public.current_tenant_id_text());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'edges' AND policyname = 'edges_tenant_write'
  ) THEN
    CREATE POLICY edges_tenant_write ON edges
      FOR ALL TO authenticated
      USING (tenant_id = public.current_tenant_id_text())
      WITH CHECK (tenant_id = public.current_tenant_id_text());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'evidence' AND policyname = 'evidence_tenant_select'
  ) THEN
    CREATE POLICY evidence_tenant_select ON evidence
      FOR SELECT TO authenticated
      USING (tenant_id = public.current_tenant_id_text());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'evidence' AND policyname = 'evidence_tenant_write'
  ) THEN
    CREATE POLICY evidence_tenant_write ON evidence
      FOR ALL TO authenticated
      USING (tenant_id = public.current_tenant_id_text())
      WITH CHECK (tenant_id = public.current_tenant_id_text());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ingest_runs' AND policyname = 'ingest_runs_tenant_select'
  ) THEN
    CREATE POLICY ingest_runs_tenant_select ON ingest_runs
      FOR SELECT TO authenticated
      USING (tenant_id = public.current_tenant_id_text());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ingest_runs' AND policyname = 'ingest_runs_tenant_write'
  ) THEN
    CREATE POLICY ingest_runs_tenant_write ON ingest_runs
      FOR ALL TO authenticated
      USING (tenant_id = public.current_tenant_id_text())
      WITH CHECK (tenant_id = public.current_tenant_id_text());
  END IF;
END
$$;
