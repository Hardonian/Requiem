-- Production readiness hardening for shared control-plane state and request coordination.
-- Purpose:
--   1. Replace single-instance filesystem control-plane persistence with a shared Postgres substrate.
--   2. Back idempotency and rate limiting with durable shared state.
--   3. Preserve tenant scoping on durable control-plane records.

CREATE TABLE IF NOT EXISTS control_plane_state (
    tenant_id TEXT PRIMARY KEY,
    version INTEGER NOT NULL DEFAULT 1,
    revision BIGINT NOT NULL DEFAULT 1,
    state_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_control_plane_state_updated_at
    ON control_plane_state (updated_at DESC);


CREATE TABLE IF NOT EXISTS control_plane_leases (
    tenant_id TEXT PRIMARY KEY,
    holder_id TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_control_plane_leases_expires_at
    ON control_plane_leases (expires_at);

CREATE TABLE IF NOT EXISTS request_idempotency (
    scope_key TEXT PRIMARY KEY,
    request_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed')),
    response_status INTEGER,
    response_headers JSONB,
    response_body TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_idempotency_expires_at
    ON request_idempotency (expires_at);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    scope_key TEXT PRIMARY KEY,
    tokens DOUBLE PRECISION NOT NULL,
    last_refill_ms BIGINT NOT NULL,
    revision BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_updated_at
    ON rate_limit_buckets (updated_at DESC);

ALTER TABLE control_plane_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'control_plane_state'
          AND policyname = 'control_plane_state_tenant_select'
    ) THEN
        CREATE POLICY control_plane_state_tenant_select ON control_plane_state
            FOR SELECT
            USING (tenant_id = COALESCE(auth.jwt() ->> 'tenant_id', current_setting('request.jwt.claims', true)::json ->> 'tenant_id'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'control_plane_state'
          AND policyname = 'control_plane_state_tenant_write'
    ) THEN
        CREATE POLICY control_plane_state_tenant_write ON control_plane_state
            FOR ALL
            USING (tenant_id = COALESCE(auth.jwt() ->> 'tenant_id', current_setting('request.jwt.claims', true)::json ->> 'tenant_id'))
            WITH CHECK (tenant_id = COALESCE(auth.jwt() ->> 'tenant_id', current_setting('request.jwt.claims', true)::json ->> 'tenant_id'));
    END IF;
END $$;

COMMENT ON TABLE control_plane_state IS 'Tenant-scoped shared control-plane state for budgets, capabilities, policies, plans, runs, snapshots, logs, and CAS metadata.';
COMMENT ON TABLE control_plane_leases IS 'Tenant-scoped lease table used to serialize durable control-plane mutations across replicas.';
COMMENT ON TABLE request_idempotency IS 'Durable request idempotency records for mutation routes.';
COMMENT ON TABLE rate_limit_buckets IS 'Shared token bucket state for multi-instance rate limiting.';
