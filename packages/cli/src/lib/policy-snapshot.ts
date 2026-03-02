/**
 * Policy Snapshot — Captures and records policy state at execution time.
 *
 * INVARIANT: Every decision MUST record the policy snapshot hash active
 * at the time of evaluation. This ensures:
 *   - Replay can verify the decision was made under the correct policy
 *   - Audit trail connects decisions to policy versions
 *   - Drift between policy and decisions is detectable
 *
 * INVARIANT: Every decision MUST produce a ledger entry. The ledger is
 * append-only and provides the immutable audit trail.
 *
 * INVARIANT: Every execution MUST record an economic event. The cost
 * ledger is the single source of truth for resource accounting.
 */

import path from 'path';
import { hash } from './hash.js';
import { readTextFile, fileExists } from './io.js';
import { getDB } from '../db/connection.js';
import { newId } from '../db/helpers.js';
import { EconomicEventRepository } from '../db/governance.js';

/**
 * Capture the current policy snapshot hash.
 * Reads the active policy file and produces a deterministic BLAKE3 hash.
 * Falls back to a sentinel hash if the policy file is not readable.
 */
export function capturePolicySnapshotHash(): string {
  const policyPaths = [
    path.join(process.cwd(), 'policy/default.policy.json'),
    path.join(process.cwd(), 'policy.json'),
  ];

  for (const policyPath of policyPaths) {
    try {
      if (fileExists(policyPath)) {
        const content = readTextFile(policyPath);
        return hash(content);
      }
    } catch {
      // Try next path
    }
  }

  // No policy file found — return sentinel that marks "no policy enforced"
  return hash('__NO_POLICY_FILE__');
}

/**
 * Write an immutable ledger entry.
 * Ledger entries are append-only and provide the audit trail.
 */
export function writeLedgerEntry(params: {
  tenantId: string;
  eventType: string;
  description: string;
  metadata?: Record<string, unknown>;
}): void {
  const db = getDB();
  const id = newId('ledger');
  const timestamp = new Date().toISOString();

  db.prepare(`
    INSERT INTO ledger (id, tenant_id, timestamp, event_type, description, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.tenantId,
    timestamp,
    params.eventType,
    params.description,
    params.metadata ? JSON.stringify(params.metadata) : null
  );
}

/**
 * Record an execution cost event tied to a specific run.
 * Enforces the invariant: same run → same ledger entries.
 */
export function recordExecutionCost(params: {
  tenantId: string;
  runId: string;
  latencyMs: number;
}): void {
  // Cost units are derived from latency in a deterministic way:
  // 1 cost unit per 100ms of execution (minimum 1)
  const costUnits = Math.max(1, Math.ceil(params.latencyMs / 100));

  EconomicEventRepository.create({
    tenantId: params.tenantId,
    runId: params.runId,
    eventType: 'execution',
    resourceUnits: 1, // 1 execution resource unit per decision
    costUnits,
  });
}

