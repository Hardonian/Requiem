-- Optimized SQLite Schema with Indexes
-- Entropy Collapse: Fast queries, prepared statements, minimal IO

-- Runs table with optimized indexes
CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL UNIQUE,
    manifest_hash TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed')),
    started_at INTEGER NOT NULL, -- Unix timestamp for faster comparison
    completed_at INTEGER,
    duration_ms INTEGER,
    tenant_id TEXT,
    policy_snapshot_hash TEXT,
    -- JSON stored as TEXT for lazy parsing
    inputs TEXT,
    outputs TEXT,
    metadata TEXT
);

-- Critical indexes for hot queries
CREATE INDEX IF NOT EXISTS idx_runs_run_id ON runs(run_id);
CREATE INDEX IF NOT EXISTS idx_runs_fingerprint ON runs(fingerprint);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at);
CREATE INDEX IF NOT EXISTS idx_runs_tenant ON runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_runs_policy ON runs(policy_snapshot_hash);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_runs_tenant_status ON runs(tenant_id, status, started_at DESC);

-- Artifacts table with content-addressed storage
CREATE TABLE IF NOT EXISTS artifacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL UNIQUE, -- BLAKE3 hash
    size_bytes INTEGER NOT NULL,
    content_type TEXT,
    created_at INTEGER NOT NULL,
    -- Lazy-loaded blob storage
    data BLOB
);

-- Critical index for artifact lookups
CREATE INDEX IF NOT EXISTS idx_artifacts_hash ON artifacts(hash);
CREATE INDEX IF NOT EXISTS idx_artifacts_created ON artifacts(created_at);

-- Ledger for audit trail
CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id TEXT NOT NULL UNIQUE,
    run_id TEXT REFERENCES runs(run_id),
    event_type TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    sequence_number INTEGER NOT NULL,
    -- Cryptographic integrity
    previous_hash TEXT,
    entry_hash TEXT NOT NULL,
    -- JSON metadata
    details TEXT
);

-- Critical indexes for ledger queries
CREATE INDEX IF NOT EXISTS idx_ledger_run_id ON ledger(run_id);
CREATE INDEX IF NOT EXISTS idx_ledger_timestamp ON ledger(timestamp);
CREATE INDEX IF NOT EXISTS idx_ledger_sequence ON ledger(sequence_number);
CREATE INDEX IF NOT EXISTS idx_ledger_type_time ON ledger(event_type, timestamp DESC);

-- Policy snapshots for versioning
CREATE TABLE IF NOT EXISTS policy_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL UNIQUE, -- SHA-256 of policy content
    version INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    created_by TEXT,
    -- Policy content stored as JSON
    content TEXT NOT NULL,
    -- Active flag for quick lookup
    is_active BOOLEAN DEFAULT 0
);

-- Critical index for policy lookups
CREATE INDEX IF NOT EXISTS idx_policy_hash ON policy_snapshots(hash);
CREATE INDEX IF NOT EXISTS idx_policy_version ON policy_snapshots(version);
CREATE INDEX IF NOT EXISTS idx_policy_active ON policy_snapshots(is_active) WHERE is_active = 1;

-- Verification cache for manifest hashes
CREATE TABLE IF NOT EXISTS verification_cache (
    manifest_hash TEXT PRIMARY KEY,
    result BOOLEAN NOT NULL,
    verified_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

-- Index for cache cleanup
CREATE INDEX IF NOT EXISTS idx_verification_expires ON verification_cache(expires_at);

-- Provider catalog cache
CREATE TABLE IF NOT EXISTS provider_catalog_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    catalog_hash TEXT NOT NULL UNIQUE,
    fetched_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    catalog_data TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_catalog_expires ON provider_catalog_cache(expires_at);

-- Cleanup old records (run periodically)
DELETE FROM ledger WHERE timestamp < (strftime('%s', 'now') - 90 * 86400); -- 90 days
DELETE FROM verification_cache WHERE expires_at < strftime('%s', 'now');
DELETE FROM provider_catalog_cache WHERE expires_at < strftime('%s', 'now');

-- Optimize database
PRAGMA optimize;
ANALYZE;
