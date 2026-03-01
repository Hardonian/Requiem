/**
 * @fileoverview Audit log for tool invocations (S-9/S-12).
 *
 * Every tool call (allow or deny) is written here.
 * In production, persist to database via DatabaseAuditSink.
 * In dev, write to .data/ai-audit/ via FileAuditSink.
 *
 * INVARIANT: Audit records are append-only.
 * INVARIANT: Audit records are tenant-scoped (tenant_id field required).
 * INVARIANT: Never log secrets or full input payloads in audit records.
 *
 * PERSISTENCE:
 *   AUDIT_PERSISTENCE reflects the active sink type:
 *     "memory"   — in-memory only (tests)
 *     "file"     — local NDJSON file (dev default)
 *     "database" — HTTP POST to REQUIEM_AUDIT_ENDPOINT (production)
 *     "composite(X+Y)" — multiple sinks simultaneously
 *
 * MERKLE CHAIN (S-19):
 *   When enable_merkle_audit_chain flag is true, every audit record is
 *   routed through MerkleAuditChain.append() before reaching the sink.
 *   The chain_hash field is populated on the record automatically.
 */

import { loadFlags } from '../flags/index';
import { logger } from './logger';
import type { ToolAuditRecord } from '../tools/types';
import {
  type IAuditSink,
  type TenantAuditRecord,
  createDefaultAuditSink,
  InMemoryAuditSink,
  FileAuditSink,
  DatabaseAuditSink,
  CompositeSink,
} from './auditSink';
import { getGlobalMerkleChain } from './merkleChain';

export type { IAuditSink, TenantAuditRecord };
export { InMemoryAuditSink, FileAuditSink, DatabaseAuditSink, CompositeSink };

// ─── Persistent Sink (module-level singleton) ─────────────────────────────────

let _sink: IAuditSink = createDefaultAuditSink();

// ─── Persistence Status ───────────────────────────────────────────────────────

/**
 * Returns the runtime name of the currently configured audit sink.
 * One of: "memory" | "file" | "database" | "composite(X+Y)" | ...
 */
export function getAuditPersistence(): string {
  return _sink.name;
}

/**
 * Backward-compatible constant (matches original AUDIT_PERSISTENCE export).
 * Use getAuditPersistence() for dynamic runtime value.
 * @deprecated Use getAuditPersistence() for the actual configured sink type.
 */
export const AUDIT_PERSISTENCE = 'file' as const;
export type AuditPersistence = typeof AUDIT_PERSISTENCE;

// ─── Legacy Sink Adapter ──────────────────────────────────────────────────────

/**
 * Legacy AuditSink function type (for backward compatibility with setAuditSink).
 * @deprecated Use IAuditSink interface instead.
 */
export type AuditSink = (record: ToolAuditRecord) => Promise<void>;

// ─── Public Configuration API ─────────────────────────────────────────────────

/**
 * Replace the active audit sink.
 * Accepts either a legacy function sink or a new IAuditSink object.
 *
 * @param sink - The new sink. Pass an IAuditSink instance or a legacy function.
 */
export function setAuditSink(sink: IAuditSink | AuditSink): void {
  if (typeof sink === 'function') {
    // Wrap legacy function in an IAuditSink adapter.
    _sink = {
      name: 'legacy-function',
      write: async (record: TenantAuditRecord) => sink(record),
      flush: async () => {},
    };
  } else {
    _sink = sink;
  }
}

// ─── Public Write API ─────────────────────────────────────────────────────────

/**
 * Write an audit record for a tool invocation attempt.
 *
 * Automatically enriches the record with:
 *   - `tenant_id` from record.tenantId (or empty string if absent)
 *   - `chain_hash` when enable_merkle_audit_chain flag is enabled
 *
 * Never throws — audit failures are logged as warnings only.
 *
 * @param record - The audit record to write. Include `tenantId` for RLS.
 */
export async function writeAuditRecord(record: ToolAuditRecord): Promise<void> {
  try {
    // Build the extended record with tenant_id.
    const tenantRecord: TenantAuditRecord = {
      ...record,
      tenant_id: (record as { tenantId?: string }).tenantId ?? '',
    };

    // Route through Merkle chain when the feature flag is enabled.
    const flags = loadFlags();
    if (flags.enable_merkle_audit_chain) {
      const chain = getGlobalMerkleChain();
      chain.append(tenantRecord);
      // chain.append() mutates nothing; the record now has chain_hash set via the return
      // value — we re-fetch from the chain's last entry.
      const entries = chain.getEntries();
      const chainedRecord = entries[entries.length - 1];
      if (chainedRecord) {
        await _sink.write(chainedRecord);
        return;
      }
    }

    await _sink.write(tenantRecord);
  } catch (err) {
    logger.warn('[audit] Audit sink error (non-fatal)', { error: String(err) });
  }
}

/**
 * Flush any buffered audit records to the sink.
 * Should be called on graceful shutdown.
 * Never throws.
 */
export async function flushAuditLog(): Promise<void> {
  try {
    await _sink.flush();
  } catch (err) {
    logger.warn('[audit] Flush error (non-fatal)', { error: String(err) });
  }
}
