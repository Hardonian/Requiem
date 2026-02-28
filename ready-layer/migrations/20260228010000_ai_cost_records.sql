-- Migration: Create the ai_cost_records table
--
-- This table stores cost and usage information for all AI operations,
-- enabling auditing, budgeting, and performance monitoring.

CREATE TABLE IF NOT EXISTS ai_cost_records (
    id TEXT PRIMARY KEY,
    traceId TEXT NOT NULL,
    tenantId TEXT NOT NULL,
    actorId TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    inputTokens INTEGER NOT NULL,
    outputTokens INTEGER NOT NULL,
    costCents REAL NOT NULL,
    latencyMs INTEGER NOT NULL,
    createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cost_records_tenant_created ON ai_cost_records (tenantId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_cost_records_trace ON ai_cost_records (traceId);
