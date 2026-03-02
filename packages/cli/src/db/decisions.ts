/**
 * Decision Data Model and Repository
 */

import { getDB } from './connection';
import { newId } from './helpers';
import { ArtifactStore } from './artifacts';
import type { DecisionInput, DecisionOutput } from '../lib/fallback';

export interface DecisionReport {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
  source_type: string;
  source_ref: string;
  input_fingerprint: string;
  decision_input: string; // JSON string
  decision_output: string | null; // JSON string
  decision_trace: string | null; // JSON string
  usage: string | null; // JSON string of AgentUsage
  recommended_action_id: string | null;
  status: 'pending' | 'evaluated' | 'accepted' | 'rejected' | 'reviewed';
  outcome_status: 'success' | 'failure' | 'mixed' | 'unknown' | null;
  outcome_notes: string | null;
  calibration_delta: number | null;
  execution_latency: number | null;
}

export interface CreateDecisionInput {
  tenant_id: string;
  source_type: string;
  source_ref: string;
  input_fingerprint: string;
  decision_input: DecisionInput | Record<string, unknown>;
  decision_output?: DecisionOutput | Record<string, unknown>;
  decision_trace?: unknown;
  usage?: unknown;
  recommended_action_id?: string;
  status?: 'pending' | 'evaluated' | 'accepted' | 'rejected' | 'reviewed';
  execution_latency?: number;
  outcome_status?: 'success' | 'failure' | 'mixed' | 'unknown' | null;
}

export interface UpdateDecisionInput {
  outcome_status?: 'success' | 'failure' | 'mixed';
  outcome_notes?: string | null;
  calibration_delta?: number | null;
  status?: 'pending' | 'evaluated' | 'accepted' | 'rejected' | 'reviewed';
}

export class DecisionRepository {
  private static stmtCache = new Map<string, any>(); // Generic 'any' for better-sqlite3 Statement

  private static getStmt(query: string) {
    if (!this.stmtCache.has(query)) {
      this.stmtCache.set(query, getDB().prepare(query));
    }
    return this.stmtCache.get(query);
  }

  /**
   * Creates a new decision report
   */
  static create(input: CreateDecisionInput): DecisionReport {
    const now = new Date().toISOString();
    const id = newId('decision');

    const report: DecisionReport = {
      id,
      tenant_id: input.tenant_id,
      created_at: now,
      updated_at: now,
      source_type: input.source_type,
      source_ref: input.source_ref,
      input_fingerprint: input.input_fingerprint,
      decision_input: ArtifactStore.collapseSync(input.decision_input),
      decision_output: input.decision_output ? ArtifactStore.collapseSync(input.decision_output) : null,
      decision_trace: input.decision_trace ? ArtifactStore.collapseSync(input.decision_trace) : null,
      usage: input.usage ? JSON.stringify(input.usage) : JSON.stringify({ prompt_tokens: 0, completion_tokens: 0, cost_usd: 0 }),
      recommended_action_id: input.recommended_action_id || null,
      status: input.status || 'pending',
      outcome_status: input.outcome_status || 'unknown',
      outcome_notes: null,
      calibration_delta: null,
      execution_latency: input.execution_latency ?? null,
    };

    const stmt = this.getStmt(`
      INSERT INTO decisions (
        id, tenant_id, created_at, updated_at, source_type, source_ref, input_fingerprint,
        decision_input, decision_output, decision_trace, usage, recommended_action_id,
        status, outcome_status, outcome_notes, calibration_delta, execution_latency
      ) VALUES (
        @id, @tenant_id, @created_at, @updated_at, @source_type, @source_ref, @input_fingerprint,
        @decision_input, @decision_output, @decision_trace, @usage, @recommended_action_id,
        @status, @outcome_status, @outcome_notes, @calibration_delta, @execution_latency
      )
    `);

    stmt.run(report);
    return report;
  }

  /**
   * Finds a decision by ID
   */
  static findById(id: string, tenantId?: string): DecisionReport | undefined {
    let report: DecisionReport | undefined;

    if (tenantId) {
      report = this.getStmt('SELECT * FROM decisions WHERE id = ? AND tenant_id = ?').get(id, tenantId) as unknown as DecisionReport | undefined;
    } else {
      report = this.getStmt('SELECT * FROM decisions WHERE id = ?').get(id) as unknown as DecisionReport | undefined;
    }

    if (report) {
      // Expand artifacts
      report.decision_input = ArtifactStore.expand(report.decision_input) || report.decision_input;
      report.decision_output = ArtifactStore.expand(report.decision_output);
      report.decision_trace = ArtifactStore.expand(report.decision_trace);
    }

    return report;
  }

  /**
   * Updates a decision
   */
  static update(id: string, input: UpdateDecisionInput): DecisionReport | undefined {
    const db = getDB();
    const existing = this.findById(id);
    if (!existing) {
      return undefined;
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      ...input,
    };

    // Build update query
    const setClause = Object.keys(updateData)
      .map(key => `${key} = @${key}`)
      .join(', ');
    this.getStmt(query).run({ ...updateData, id });
    return this.findById(id);
  }

  /**
   * Lists decisions with optional filtering
   */
  static list(options?: {
    tenantId?: string;
    sourceType?: string;
    status?: string;
    outcomeStatus?: string;
    createdAfter?: string;
    limit?: number;
    offset?: number;
  }): DecisionReport[] {
    const db = getDB();
    let query = 'SELECT * FROM decisions';
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (options?.tenantId) {
      conditions.push('tenant_id = ?');
      params.push(options.tenantId);
    }

    if (options?.sourceType) {
      conditions.push('source_type = ?');
      params.push(options.sourceType);
    }

    if (options?.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }

    if (options?.outcomeStatus) {
      conditions.push('outcome_status = ?');
      params.push(options.outcomeStatus);
    }

    if (options?.createdAfter) {
      conditions.push('created_at >= ?');
      params.push(options.createdAfter);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options?.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    return getDB().prepare(query).all(...params) as unknown as DecisionReport[];
  }

  /**
   * Deletes a decision
   */
  static delete(id: string): boolean {
    const result = this.getStmt('DELETE FROM decisions WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Aggregates telemetry stats
   */
  static getStats(tenantId?: string): {
    total_decisions: number;
    avg_latency_ms: number;
    total_cost_usd: number;
    success_rate: number;
  } {
    const decisions = this.list({ tenantId });
    const total = decisions.length;

    if (total === 0) {
      return { total_decisions: 0, avg_latency_ms: 0, total_cost_usd: 0, success_rate: 0 };
    }

    let totalLatency = 0;
    let latencyCount = 0;
    let totalCost = 0;
    let successCount = 0;

    for (const d of decisions) {
      if (d.execution_latency != null) {
        totalLatency += d.execution_latency;
        latencyCount++;
      }

      if (d.usage) {
        try {
          const u = JSON.parse(d.usage);
          if (typeof u.cost_usd === 'number') {
            totalCost += u.cost_usd;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      if (d.outcome_status === 'success') {
        successCount++;
      }
    }

    return {
      total_decisions: total,
      avg_latency_ms: latencyCount > 0 ? totalLatency / latencyCount : 0,
      total_cost_usd: totalCost,
      success_rate: successCount / total,
    };
  }
}

/**
 * Calibration Repository
 * Automates the feedback loop for decision improvement.
 */
export class CalibrationRepository {
  /**
   * Calculates the cumulative accuracy bias for a source type.
   * This represents the drift between predicted success and actual outcome.
   */
  static getAverageDelta(tenantId: string, sourceType: string): number {
    const result = getDB().prepare(`
      SELECT AVG(calibration_delta) as avg_delta
      FROM decisions
      WHERE tenant_id = ? AND source_type = ? AND calibration_delta IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 100
    `).get(tenantId, sourceType) as { avg_delta: number | null };

    return result?.avg_delta || 0;
  }
}
