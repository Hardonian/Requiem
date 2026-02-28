/**
 * @fileoverview Audit log for tool invocations.
 *
 * Every tool call (allow or deny) is written here.
 * In production, persist to database. In dev, write to .data/ai-audit/.
 *
 * INVARIANT: Audit records are append-only.
 * INVARIANT: Audit records are tenant-scoped.
 * INVARIANT: Never log secrets or full input payloads in audit records.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from './logger.js';
import type { ToolAuditRecord } from '../tools/types.js';

// ─── Audit Sink Interface ─────────────────────────────────────────────────────

export type AuditSink = (record: ToolAuditRecord) => Promise<void>;

/** File-backed audit sink for development */
async function fileAuditSink(record: ToolAuditRecord): Promise<void> {
  const dir = join(process.cwd(), '.data', 'ai-audit');
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const file = join(dir, `audit-${record.timestamp.slice(0, 10)}.ndjson`);
    writeFileSync(file, JSON.stringify(record) + '\n', { flag: 'a' });
  } catch (err) {
    logger.warn('[audit] Failed to write audit record to file', { error: String(err) });
  }
}

let _sink: AuditSink = fileAuditSink;

/** Replace audit sink (e.g., DB-backed for production). */
export function setAuditSink(sink: AuditSink): void {
  _sink = sink;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Write an audit record for a tool invocation attempt.
 * Never throws — audit failures are logged as warnings only.
 */
export async function writeAuditRecord(record: ToolAuditRecord): Promise<void> {
  try {
    await _sink(record);
  } catch (err) {
    logger.warn('[audit] Audit sink error (non-fatal)', { error: String(err) });
  }
}
