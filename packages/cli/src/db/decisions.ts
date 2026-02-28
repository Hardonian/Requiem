/**
 * Decision Data Model and Repository
 */

import { getDB } from './connection';
import { newId } from './helpers';
import type { DecisionInput, DecisionOutput } from '../lib/fallback';

export interface DecisionReport {
  id: string;
  created_at: string;
  updated_at: string;
  source_type: string;
  source_ref: string;
  input_fingerprint: string;
  decision_input: string; // JSON string
  decision_output: string | null; // JSON string
  decision_trace: string | null; // JSON string
  recommended_action_id: string | null;
  status: 'pending' | 'evaluated' | 'accepted' | 'rejected' | 'reviewed';
  outcome_status: 'success' | 'failure' | 'mixed' | 'unknown' | null;
  outcome_notes: string | null;
  calibration_delta: number | null;
}

export interface CreateDecisionInput {
  source_type: string;
  source_ref: string;
  input_fingerprint: string;
  decision_input: DecisionInput;
  decision_output?: DecisionOutput;
  decision_trace?: any;
  recommended_action_id?: string;
  status?: 'pending' | 'evaluated' | 'accepted' | 'rejected' | 'reviewed';
}

export interface UpdateDecisionInput {
  outcome_status?: 'success' | 'failure' | 'mixed';
  outcome_notes?: string | null;
  calibration_delta?: number | null;
  status?: 'pending' | 'evaluated' | 'accepted' | 'rejected' | 'reviewed';
}

export class DecisionRepository {
  /**
   * Creates a new decision report
   */
  static create(input: CreateDecisionInput): DecisionReport {
    const db = getDB();
    const now = new Date().toISOString();
    const id = newId('decision');

    const report: DecisionReport = {
      id,
      created_at: now,
      updated_at: now,
      source_type: input.source_type,
      source_ref: input.source_ref,
      input_fingerprint: input.input_fingerprint,
      decision_input: JSON.stringify(input.decision_input),
      decision_output: input.decision_output ? JSON.stringify(input.decision_output) : null,
      decision_trace: input.decision_trace ? JSON.stringify(input.decision_trace) : null,
      recommended_action_id: input.recommended_action_id || null,
      status: input.status || 'pending',
      outcome_status: 'unknown',
      outcome_notes: null,
      calibration_delta: null,
    };

    const stmt = db.prepare(`
      INSERT INTO decisions (
        id, created_at, updated_at, source_type, source_ref, input_fingerprint,
        decision_input, decision_output, decision_trace, recommended_action_id,
        status, outcome_status, outcome_notes, calibration_delta
      ) VALUES (
        @id, @created_at, @updated_at, @source_type, @source_ref, @input_fingerprint,
        @decision_input, @decision_output, @decision_trace, @recommended_action_id,
        @status, @outcome_status, @outcome_notes, @calibration_delta
      )
    `);

    stmt.run(report);
    return report;
  }

  /**
   * Finds a decision by ID
   */
  static findById(id: string): DecisionReport | undefined {
    const db = getDB();
    return db.prepare('SELECT * FROM decisions WHERE id = ?').get(id) as DecisionReport | undefined;
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

    const updateData: any = {
      updated_at: new Date().toISOString(),
      ...input,
    };

    // Build update query
    const setClause = Object.keys(updateData)
      .map(key => `${key} = @${key}`)
      .join(', ');
    const query = `UPDATE decisions SET ${setClause} WHERE id = @id`;

    db.prepare(query).run({ ...updateData, id });
    return this.findById(id);
  }

  /**
   * Lists decisions with optional filtering
   */
  static list(options?: {
    sourceType?: string;
    status?: string;
    outcomeStatus?: string;
    limit?: number;
    offset?: number;
  }): DecisionReport[] {
    const db = getDB();
    let query = 'SELECT * FROM decisions';
    const params: any[] = [];
    const conditions: string[] = [];

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

    return db.prepare(query).all(...params) as DecisionReport[];
  }

  /**
   * Deletes a decision
   */
  static delete(id: string): boolean {
    const db = getDB();
    const result = db.prepare('DELETE FROM decisions WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
