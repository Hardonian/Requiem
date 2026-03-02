/**
 * Junction Data Model and Repository
 */

import { getDB } from './connection.js';
import { newId } from './helpers.js';

export interface Junction {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
  junction_type: 'diff_critical' | 'drift_alert' | 'trust_drop' | 'policy_violation';
  severity_score: number;
  fingerprint: string;
  source_type: 'diff' | 'drift' | 'policy' | 'trust';
  source_ref: string;
  trigger_data: string; // JSON string
  trigger_trace: string; // JSON string
  cooldown_until: string | null;
  deduplication_key: string | null;
  decision_report_id: string | null;
  status: 'active' | 'resolved' | 'suppressed';
}

export interface ActionIntent {
  id: string;
  created_at: string;
  decision_report_id: string;
  action_type: string;
  action_payload: string; // JSON string
  status: 'pending' | 'executed' | 'failed' | 'cancelled';
  executed_at: string | null;
  execution_result: string | null;
}

export interface CreateJunctionInput {
  tenant_id: string; // Required for isolation
  junction_type: 'diff_critical' | 'drift_alert' | 'trust_drop' | 'policy_violation';
  severity_score: number;
  fingerprint: string;
  source_type: 'diff' | 'drift' | 'policy' | 'trust';
  source_ref: string;
  trigger_data: Record<string, unknown>;
  trigger_trace: Record<string, unknown>;
  deduplication_key?: string;
  cooldown_hours?: number;
}

export interface CreateActionIntentInput {
  decision_report_id: string;
  action_type: string;
  action_payload: Record<string, unknown>;
}

export class JunctionRepository {
  /**
   * Creates a new junction
   */
  static create(input: CreateJunctionInput): Junction {
    const db = getDB();
    const now = new Date().toISOString();
    const id = newId('junction');

    const cooldownUntil = input.cooldown_hours
      ? new Date(Date.now() + input.cooldown_hours * 60 * 60 * 1000).toISOString()
      : null;

    const junction: Junction = {
      id,
      tenant_id: input.tenant_id,
      created_at: now,
      updated_at: now,
      junction_type: input.junction_type,
      severity_score: input.severity_score,
      fingerprint: input.fingerprint,
      source_type: input.source_type,
      source_ref: input.source_ref,
      trigger_data: JSON.stringify(input.trigger_data),
      trigger_trace: JSON.stringify(input.trigger_trace),
      cooldown_until: cooldownUntil,
      deduplication_key: input.deduplication_key || null,
      decision_report_id: null,
      status: 'active',
    };

    const stmt = db.prepare(`
      INSERT INTO junctions (
        id, tenant_id, created_at, updated_at, junction_type, severity_score, fingerprint,
        source_type, source_ref, trigger_data, trigger_trace, cooldown_until,
        deduplication_key, decision_report_id, status
      ) VALUES (
        @id, @tenant_id, @created_at, @updated_at, @junction_type, @severity_score, @fingerprint,
        @source_type, @source_ref, @trigger_data, @trigger_trace, @cooldown_until,
        @deduplication_key, @decision_report_id, @status
      )
    `);

    stmt.run(junction);
    return junction;
  }

  /**
   * Finds a junction by ID
   */
  static findById(id: string, tenantId?: string): Junction | undefined {
    const db = getDB();
    if (tenantId) {
      return db.prepare('SELECT * FROM junctions WHERE id = ? AND tenant_id = ?').get(id, tenantId) as unknown as Junction | undefined;
    }
    return db.prepare('SELECT * FROM junctions WHERE id = ?').get(id) as unknown as Junction | undefined;
  }

  /**
   * Finds junctions by fingerprint
   */
  static findByFingerprint(fingerprint: string): Junction[] {
    const db = getDB();
    return db.prepare('SELECT * FROM junctions WHERE fingerprint = ?').all(fingerprint) as unknown as Junction[];
  }

  /**
   * Finds junctions by deduplication key
   */
  static findByDeduplicationKey(key: string): Junction | undefined {
    const db = getDB();
    return db.prepare('SELECT * FROM junctions WHERE deduplication_key = ? AND status = ?').get(key, 'active') as unknown as Junction | undefined;
  }

  /**
   * Checks if a junction with the given deduplication key exists and is not in cooldown
   */
  static isInCooldown(deduplicationKey: string): boolean {
    const db = getDB();
    const now = new Date().toISOString();
    const existing = db.prepare(`
      SELECT id FROM junctions
      WHERE deduplication_key = ?
        AND status = 'active'
        AND cooldown_until IS NOT NULL
        AND cooldown_until > ?
    `).get(deduplicationKey, now);
    return !!existing;
  }

  /**
   * Updates a junction
   */
  static update(id: string, input: Partial<Junction>): Junction | undefined {
    const db = getDB();
    const existing = this.findById(id);
    if (!existing) {
      return undefined;
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      ...input,
    };

    // Handle JSON fields
    if (input.trigger_data && typeof input.trigger_data === 'string') {
      updateData.trigger_data = input.trigger_data;
    }
    if (input.trigger_trace && typeof input.trigger_trace === 'string') {
      updateData.trigger_trace = input.trigger_trace;
    }

    // Build update query
    const setClause = Object.keys(updateData)
      .map(key => `${key} = @${key}`)
      .join(', ');
    const query = `UPDATE junctions SET ${setClause} WHERE id = @id`;

    db.prepare(query).run({ ...updateData, id });
    return this.findById(id);
  }

  /**
   * Links a junction to a decision report
   */
  static linkToDecision(junctionId: string, decisionReportId: string): Junction | undefined {
    return this.update(junctionId, { decision_report_id: decisionReportId });
  }

  /**
   * Resolves a junction
   */
  static resolve(id: string): Junction | undefined {
    return this.update(id, { status: 'resolved' });
  }

  /**
   * Suppresses a junction
   */
  static suppress(id: string): Junction | undefined {
    return this.update(id, { status: 'suppressed' });
  }

  /**
   * Lists junctions with optional filtering
   */
  static list(options?: {
    tenantId?: string;
    junctionType?: string;
    sourceType?: string;
    status?: string;
    minSeverity?: number;
    limit?: number;
    offset?: number;
  }): Junction[] {
    const db = getDB();
    let query = 'SELECT * FROM junctions';
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (options?.tenantId) {
      conditions.push('tenant_id = ?');
      params.push(options.tenantId);
    }

    if (options?.junctionType) {
      conditions.push('junction_type = ?');
      params.push(options.junctionType);
    }

    if (options?.sourceType) {
      conditions.push('source_type = ?');
      params.push(options.sourceType);
    }

    if (options?.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }

    if (options?.minSeverity !== undefined) {
      conditions.push('severity_score >= ?');
      params.push(options.minSeverity);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY severity_score DESC, created_at DESC';

    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options?.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    return db.prepare(query).all(...params) as unknown as Junction[];
  }
}

export class ActionIntentRepository {
  /**
   * Creates a new action intent
   */
  static create(input: CreateActionIntentInput): ActionIntent {
    const db = getDB();
    const now = new Date().toISOString();
    const id = newId('action');

    const intent: ActionIntent = {
      id,
      created_at: now,
      decision_report_id: input.decision_report_id,
      action_type: input.action_type,
      action_payload: JSON.stringify(input.action_payload),
      status: 'pending',
      executed_at: null,
      execution_result: null,
    };

    const stmt = db.prepare(`
      INSERT INTO action_intents (
        id, created_at, decision_report_id, action_type, action_payload, status, executed_at, execution_result
      ) VALUES (
        @id, @created_at, @decision_report_id, @action_type, @action_payload, @status, @executed_at, @execution_result
      )
    `);

    stmt.run(intent);
    return intent;
  }

  /**
   * Finds action intents by decision report ID
   */
  static findByDecisionReport(decisionReportId: string): ActionIntent[] {
    const db = getDB();
    return db.prepare('SELECT * FROM action_intents WHERE decision_report_id = ?').all(decisionReportId) as unknown as ActionIntent[];
  }

  /**
   * Marks an action intent as executed
   */
  static markExecuted(id: string, result: Record<string, unknown>): ActionIntent | undefined {
    const db = getDB();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE action_intents
      SET status = 'executed', executed_at = ?, execution_result = ?
      WHERE id = ?
    `).run(now, JSON.stringify(result), id);

    return db.prepare('SELECT * FROM action_intents WHERE id = ?').get(id) as unknown as ActionIntent | undefined;
  }

  /**
   * Marks an action intent as failed
   */
  static markFailed(id: string, error: string): ActionIntent | undefined {
    const db = getDB();
    db.prepare(`
      UPDATE action_intents
      SET status = 'failed', execution_result = ?
      WHERE id = ?
    `).run(JSON.stringify({ error }), id);

    return db.prepare('SELECT * FROM action_intents WHERE id = ?').get(id) as ActionIntent | undefined;
  }

  /**
   * Cancels an action intent
   */
  static cancel(id: string): ActionIntent | undefined {
    const db = getDB();
    db.prepare(`UPDATE action_intents SET status = 'cancelled' WHERE id = ?`).run(id);
    return db.prepare('SELECT * FROM action_intents WHERE id = ?').get(id) as ActionIntent | undefined;
  }
}

