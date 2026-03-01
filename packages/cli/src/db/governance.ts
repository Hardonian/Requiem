/**
 * Governance Repository
 * 
 * Provides deterministic CRUD operations for:
 * - Learning signals, diagnoses, and patches
 * - Symmetry metrics
 * - Economic events, rollups, and alerts
 * - Skills registry
 * 
 * All operations are pure functions of stored data.
 */

import { getDB } from './connection';
import { randomUUID } from 'crypto';

// ─── Types ───────────────────────────────────────────────────────────────────────

export type SignalCategory = 
  | 'build_failure'
  | 'drift'
  | 'policy_violation'
  | 'replay_mismatch'
  | 'test_failure'
  | 'schema_gap'
  | 'skill_gap'
  | 'rollback_event'
  | 'cost_spike'
  | 'fairness_violation';

export type RootCause = 
  | 'prompt_gap'
  | 'skill_gap'
  | 'schema_gap'
  | 'config_gap'
  | 'policy_gap'
  | 'strategic_misalignment'
  | 'economic_misalignment';

export type PatchType = 
  | 'skill_update'
  | 'prompt_update'
  | 'schema_update'
  | 'config_update'
  | 'branch_plan'
  | 'rollback_plan'
  | 'cost_model_update'
  | 'fairness_policy_update';

export type PatchStatus = 'proposed' | 'applied' | 'rejected';

export type EventType = 
  | 'execution'
  | 'replay_storage'
  | 'policy_eval'
  | 'drift_analysis';

export type AlertType = 
  | 'burn_spike'
  | 'storage_spike'
  | 'policy_spike'
  | 'fairness_violation';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export type MetricName = 
  | 'failure_recurrence_rate'
  | 'drift_severity_score'
  | 'replay_mismatch_rate'
  | 'time_to_green'
  | 'rollback_frequency'
  | 'skill_coverage_ratio'
  | 'instruction_coverage_score'
  | 'burn_rate'
  | 'cost_per_verified_run'
  | 'replay_efficiency_ratio'
  | 'fairness_index';

export interface LearningSignal {
  id: string;
  tenant_id: string;
  run_id: string | null;
  category: SignalCategory;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
}

export interface LearningDiagnosis {
  id: string;
  tenant_id: string;
  signal_ids: string[];
  root_cause: RootCause;
  confidence_score: number;
  created_at: string;
}

export interface LearningPatch {
  id: string;
  tenant_id: string;
  diagnosis_id: string;
  patch_type: PatchType;
  target_files: string[];
  patch_diff_json: Record<string, unknown> | null;
  rollback_plan_json: Record<string, unknown> | null;
  status: PatchStatus;
  created_at: string;
}

export interface SymmetryMetric {
  id: string;
  tenant_id: string;
  metric_name: MetricName;
  metric_value: number;
  period_start: string;
  period_end: string;
  created_at: string;
}

export interface EconomicEvent {
  id: string;
  tenant_id: string;
  run_id: string | null;
  event_type: EventType;
  resource_units: number;
  cost_units: number;
  created_at: string;
}

export interface EconomicRollup {
  id: string;
  tenant_id: string;
  period_start: string;
  period_end: string;
  total_runs: number;
  total_cost_units: number;
  total_storage_units: number;
  total_policy_units: number;
  burn_rate: number;
  created_at: string;
}

export interface EconomicAlert {
  id: string;
  tenant_id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
}

export interface Skill {
  id: string;
  scope: 'execution' | 'verification' | 'policy';
  triggers: SignalCategory[];
  required_inputs: string[];
  expected_outputs: string[];
  verification_steps: string[];
  rollback_instructions: string;
  version: string;
  created_at: string;
}

// ─── Signal Repository ─────────────────────────────────────────────────────────

export const LearningSignalRepository = {
  create(params: {
    tenantId: string;
    runId?: string;
    category: SignalCategory;
    metadata?: Record<string, unknown>;
  }): LearningSignal {
    const db = getDB();
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO learning_signals (id, tenant_id, run_id, category, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.tenantId,
      params.runId || null,
      params.category,
      params.metadata ? JSON.stringify(params.metadata) : null,
      createdAt
    );
    
    return {
      id,
      tenant_id: params.tenantId,
      run_id: params.runId || null,
      category: params.category,
      metadata_json: params.metadata || null,
      created_at: createdAt,
    };
  },

  findByTenantAndCategory(
    tenantId: string,
    category: SignalCategory,
    since?: Date
  ): LearningSignal[] {
    const db = getDB();
    let sql = `
      SELECT * FROM learning_signals 
      WHERE tenant_id = ? AND category = ?
    `;
    const params: (string | undefined)[] = [tenantId, category];
    
    if (since) {
      sql += ` AND created_at >= ?`;
      params.push(since.toISOString());
    }
    
    sql += ` ORDER BY created_at DESC`;
    
    const rows = db.prepare(sql).all(...params) as Array<{
      id: string;
      tenant_id: string;
      run_id: string | null;
      category: string;
      metadata_json: string | null;
      created_at: string;
    }>;
    
    return rows.map(row => ({
      ...row,
      category: row.category as SignalCategory,
      metadata_json: row.metadata_json ? JSON.parse(row.metadata_json) : null,
    }));
  },

  findAllByTenant(tenantId: string, since?: Date): LearningSignal[] {
    const db = getDB();
    let sql = `SELECT * FROM learning_signals WHERE tenant_id = ?`;
    const params: string[] = [tenantId];
    
    if (since) {
      sql += ` AND created_at >= ?`;
      params.push(since.toISOString());
    }
    
    sql += ` ORDER BY created_at DESC`;
    
    const rows = db.prepare(sql).all(...params) as Array<{
      id: string;
      tenant_id: string;
      run_id: string | null;
      category: string;
      metadata_json: string | null;
      created_at: string;
    }>;
    
    return rows.map(row => ({
      ...row,
      category: row.category as SignalCategory,
      metadata_json: row.metadata_json ? JSON.parse(row.metadata_json) : null,
    }));
  },

  countByCategory(tenantId: string, since?: Date): Record<SignalCategory, number> {
    const signals = this.findAllByTenant(tenantId, since);
    const counts: Partial<Record<SignalCategory, number>> = {};
    
    for (const signal of signals) {
      counts[signal.category] = (counts[signal.category] || 0) + 1;
    }
    
    return counts as Record<SignalCategory, number>;
  },
};

// ─── Diagnosis Repository ────────────────────────────────────────────────────────

export const LearningDiagnosisRepository = {
  create(params: {
    tenantId: string;
    signalIds: string[];
    rootCause: RootCause;
    confidenceScore: number;
  }): LearningDiagnosis {
    const db = getDB();
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO learning_diagnoses (id, tenant_id, signal_ids, root_cause, confidence_score, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.tenantId,
      JSON.stringify(params.signalIds),
      params.rootCause,
      params.confidenceScore,
      createdAt
    );
    
    return {
      id,
      tenant_id: params.tenantId,
      signal_ids: params.signalIds,
      root_cause: params.rootCause,
      confidence_score: params.confidenceScore,
      created_at: createdAt,
    };
  },

  findByTenant(tenantId: string, since?: Date): LearningDiagnosis[] {
    const db = getDB();
    let sql = `SELECT * FROM learning_diagnoses WHERE tenant_id = ?`;
    const params: string[] = [tenantId];
    
    if (since) {
      sql += ` AND created_at >= ?`;
      params.push(since.toISOString());
    }
    
    sql += ` ORDER BY confidence_score DESC, created_at DESC`;
    
    const rows = db.prepare(sql).all(...params) as Array<{
      id: string;
      tenant_id: string;
      signal_ids: string;
      root_cause: string;
      confidence_score: number;
      created_at: string;
    }>;
    
    return rows.map(row => ({
      id: row.id,
      tenant_id: row.tenant_id,
      signal_ids: JSON.parse(row.signal_ids),
      root_cause: row.root_cause as RootCause,
      confidence_score: row.confidence_score,
      created_at: row.created_at,
    }));
  },

  findById(id: string): LearningDiagnosis | null {
    const db = getDB();
    const row = db.prepare(`SELECT * FROM learning_diagnoses WHERE id = ?`).get(id) as {
      id: string;
      tenant_id: string;
      signal_ids: string;
      root_cause: string;
      confidence_score: number;
      created_at: string;
    } | undefined;
    
    if (!row) return null;
    
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      signal_ids: JSON.parse(row.signal_ids),
      root_cause: row.root_cause as RootCause,
      confidence_score: row.confidence_score,
      created_at: row.created_at,
    };
  },
};

// ─── Patch Repository ────────────────────────────────────────────────────────────

export const LearningPatchRepository = {
  create(params: {
    tenantId: string;
    diagnosisId: string;
    patchType: PatchType;
    targetFiles: string[];
    patchDiff?: Record<string, unknown>;
    rollbackPlan?: Record<string, unknown>;
  }): LearningPatch {
    const db = getDB();
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO learning_patches (id, tenant_id, diagnosis_id, patch_type, target_files, patch_diff_json, rollback_plan_json, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.tenantId,
      params.diagnosisId,
      params.patchType,
      JSON.stringify(params.targetFiles),
      params.patchDiff ? JSON.stringify(params.patchDiff) : null,
      params.rollbackPlan ? JSON.stringify(params.rollbackPlan) : null,
      'proposed',
      createdAt
    );
    
    return {
      id,
      tenant_id: params.tenantId,
      diagnosis_id: params.diagnosisId,
      patch_type: params.patchType,
      target_files: params.targetFiles,
      patch_diff_json: params.patchDiff || null,
      rollback_plan_json: params.rollbackPlan || null,
      status: 'proposed',
      created_at: createdAt,
    };
  },

  findByTenant(tenantId: string, status?: PatchStatus): LearningPatch[] {
    const db = getDB();
    let sql = `SELECT * FROM learning_patches WHERE tenant_id = ?`;
    const params: (string)[] = [tenantId];
    
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    
    sql += ` ORDER BY created_at DESC`;
    
    const rows = db.prepare(sql).all(...params) as Array<{
      id: string;
      tenant_id: string;
      diagnosis_id: string;
      patch_type: string;
      target_files: string;
      patch_diff_json: string | null;
      rollback_plan_json: string | null;
      status: string;
      created_at: string;
    }>;
    
    return rows.map(row => ({
      id: row.id,
      tenant_id: row.tenant_id,
      diagnosis_id: row.diagnosis_id,
      patch_type: row.patch_type as PatchType,
      target_files: JSON.parse(row.target_files),
      patch_diff_json: row.patch_diff_json ? JSON.parse(row.patch_diff_json) : null,
      rollback_plan_json: row.rollback_plan_json ? JSON.parse(row.rollback_plan_json) : null,
      status: row.status as PatchStatus,
      created_at: row.created_at,
    }));
  },

  findById(id: string): LearningPatch | null {
    const db = getDB();
    const row = db.prepare(`SELECT * FROM learning_patches WHERE id = ?`).get(id) as {
      id: string;
      tenant_id: string;
      diagnosis_id: string;
      patch_type: string;
      target_files: string;
      patch_diff_json: string | null;
      rollback_plan_json: string | null;
      status: string;
      created_at: string;
    } | undefined;
    
    if (!row) return null;
    
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      diagnosis_id: row.diagnosis_id,
      patch_type: row.patch_type as PatchType,
      target_files: JSON.parse(row.target_files),
      patch_diff_json: row.patch_diff_json ? JSON.parse(row.patch_diff_json) : null,
      rollback_plan_json: row.rollback_plan_json ? JSON.parse(row.rollback_plan_json) : null,
      status: row.status as PatchStatus,
      created_at: row.created_at,
    };
  },

  updateStatus(id: string, status: PatchStatus): void {
    const db = getDB();
    db.prepare(`UPDATE learning_patches SET status = ? WHERE id = ?`).run(status, id);
  },
};

// ─── Symmetry Metrics Repository ─────────────────────────────────────────────────

export const SymmetryMetricRepository = {
  create(params: {
    tenantId: string;
    metricName: MetricName;
    metricValue: number;
    periodStart: Date;
    periodEnd: Date;
  }): SymmetryMetric {
    const db = getDB();
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO symmetry_metrics (id, tenant_id, metric_name, metric_value, period_start, period_end, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.tenantId,
      params.metricName,
      params.metricValue,
      params.periodStart.toISOString(),
      params.periodEnd.toISOString(),
      createdAt
    );
    
    return {
      id,
      tenant_id: params.tenantId,
      metric_name: params.metricName,
      metric_value: params.metricValue,
      period_start: params.periodStart.toISOString(),
      period_end: params.periodEnd.toISOString(),
      created_at: createdAt,
    };
  },

  findByTenant(tenantId: string, metricName?: MetricName): SymmetryMetric[] {
    const db = getDB();
    let sql = `SELECT * FROM symmetry_metrics WHERE tenant_id = ?`;
    const params: string[] = [tenantId];
    
    if (metricName) {
      sql += ` AND metric_name = ?`;
      params.push(metricName);
    }
    
    sql += ` ORDER BY period_start DESC`;
    
    const rows = db.prepare(sql).all(...params) as Array<{
      id: string;
      tenant_id: string;
      metric_name: string;
      metric_value: number;
      period_start: string;
      period_end: string;
      created_at: string;
    }>;
    
    return rows.map(row => ({
      id: row.id,
      tenant_id: row.tenant_id,
      metric_name: row.metric_name as MetricName,
      metric_value: row.metric_value,
      period_start: row.period_start,
      period_end: row.period_end,
      created_at: row.created_at,
    }));
  },

  getLatest(tenantId: string, metricName: MetricName): SymmetryMetric | null {
    const metrics = this.findByTenant(tenantId, metricName);
    return metrics[0] || null;
  },
};

// ─── Economic Events Repository ─────────────────────────────────────────────────

export const EconomicEventRepository = {
  create(params: {
    tenantId: string;
    runId?: string;
    eventType: EventType;
    resourceUnits: number;
    costUnits: number;
  }): EconomicEvent {
    const db = getDB();
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO economic_events (id, tenant_id, run_id, event_type, resource_units, cost_units, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.tenantId,
      params.runId || null,
      params.eventType,
      params.resourceUnits,
      params.costUnits,
      createdAt
    );
    
    return {
      id,
      tenant_id: params.tenantId,
      run_id: params.runId || null,
      event_type: params.eventType,
      resource_units: params.resourceUnits,
      cost_units: params.costUnits,
      created_at: createdAt,
    };
  },

  findByTenant(tenantId: string, since?: Date): EconomicEvent[] {
    const db = getDB();
    let sql = `SELECT * FROM economic_events WHERE tenant_id = ?`;
    const params: (string)[] = [tenantId];
    
    if (since) {
      sql += ` AND created_at >= ?`;
      params.push(since.toISOString());
    }
    
    sql += ` ORDER BY created_at DESC`;
    
    return db.prepare(sql).all(...params) as unknown as EconomicEvent[];
  },

  sumByType(tenantId: string, since?: Date): Record<EventType, { resources: number; costs: number }> {
    const events = this.findByTenant(tenantId, since);
    const sums: Partial<Record<EventType, { resources: number; costs: number }>> = {};
    
    for (const event of events) {
      if (!sums[event.event_type]) {
        sums[event.event_type] = { resources: 0, costs: 0 };
      }
      sums[event.event_type]!.resources += event.resource_units;
      sums[event.event_type]!.costs += event.cost_units;
    }
    
    return sums as Record<EventType, { resources: number; costs: number }>;
  },
};

// ─── Economic Rollups Repository ───────────────────────────────────────────────

export const EconomicRollupRepository = {
  create(params: {
    tenantId: string;
    periodStart: Date;
    periodEnd: Date;
    totalRuns: number;
    totalCostUnits: number;
    totalStorageUnits: number;
    totalPolicyUnits: number;
  }): EconomicRollup {
    const db = getDB();
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const burnRate = params.totalCostUnits / Math.max(params.totalRuns, 1);
    
    db.prepare(`
      INSERT INTO economic_rollups (id, tenant_id, period_start, period_end, total_runs, total_cost_units, total_storage_units, total_policy_units, burn_rate, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.tenantId,
      params.periodStart.toISOString(),
      params.periodEnd.toISOString(),
      params.totalRuns,
      params.totalCostUnits,
      params.totalStorageUnits,
      params.totalPolicyUnits,
      burnRate,
      createdAt
    );
    
    return {
      id,
      tenant_id: params.tenantId,
      period_start: params.periodStart.toISOString(),
      period_end: params.periodEnd.toISOString(),
      total_runs: params.totalRuns,
      total_cost_units: params.totalCostUnits,
      total_storage_units: params.totalStorageUnits,
      total_policy_units: params.totalPolicyUnits,
      burn_rate: burnRate,
      created_at: createdAt,
    };
  },

  findByTenant(tenantId: string): EconomicRollup[] {
    const db = getDB();
    const rows = db.prepare(`
      SELECT * FROM economic_rollups 
      WHERE tenant_id = ? 
      ORDER BY period_start DESC
    `).all(tenantId) as unknown as EconomicRollup[];
    
    return rows;
  },

  getLatest(tenantId: string): EconomicRollup | null {
    const rollups = this.findByTenant(tenantId);
    return rollups[0] || null;
  },
};

// ─── Economic Alerts Repository ─────────────────────────────────────────────────

export const EconomicAlertRepository = {
  create(params: {
    tenantId: string;
    alertType: AlertType;
    severity: AlertSeverity;
    metadata?: Record<string, unknown>;
  }): EconomicAlert {
    const db = getDB();
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO economic_alerts (id, tenant_id, alert_type, severity, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.tenantId,
      params.alertType,
      params.severity,
      params.metadata ? JSON.stringify(params.metadata) : null,
      createdAt
    );
    
    return {
      id,
      tenant_id: params.tenantId,
      alert_type: params.alertType,
      severity: params.severity,
      metadata_json: params.metadata || null,
      created_at: createdAt,
    };
  },

  findByTenant(tenantId: string, alertType?: AlertType, severity?: AlertSeverity): EconomicAlert[] {
    const db = getDB();
    let sql = `SELECT * FROM economic_alerts WHERE tenant_id = ?`;
    const params: (string)[] = [tenantId];
    
    if (alertType) {
      sql += ` AND alert_type = ?`;
      params.push(alertType);
    }
    
    if (severity) {
      sql += ` AND severity = ?`;
      params.push(severity);
    }
    
    sql += ` ORDER BY created_at DESC`;
    
    const rows = db.prepare(sql).all(...params) as Array<{
      id: string;
      tenant_id: string;
      alert_type: string;
      severity: string;
      metadata_json: string | null;
      created_at: string;
    }>;
    
    return rows.map(row => ({
      id: row.id,
      tenant_id: row.tenant_id,
      alert_type: row.alert_type as AlertType,
      severity: row.severity as AlertSeverity,
      metadata_json: row.metadata_json ? JSON.parse(row.metadata_json) : null,
      created_at: row.created_at,
    }));
  },
};

// ─── Skills Registry Repository ────────────────────────────────────────────────

export const SkillRepository = {
  create(params: {
    id: string;
    scope: 'execution' | 'verification' | 'policy';
    triggers: SignalCategory[];
    requiredInputs: string[];
    expectedOutputs: string[];
    verificationSteps: string[];
    rollbackInstructions: string;
    version: string;
  }): Skill {
    const db = getDB();
    const createdAt = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO skills (id, scope, triggers, required_inputs, expected_outputs, verification_steps, rollback_instructions, version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.id,
      params.scope,
      JSON.stringify(params.triggers),
      JSON.stringify(params.requiredInputs),
      JSON.stringify(params.expectedOutputs),
      JSON.stringify(params.verificationSteps),
      params.rollbackInstructions,
      params.version,
      createdAt
    );
    
    return {
      id: params.id,
      scope: params.scope,
      triggers: params.triggers,
      required_inputs: params.requiredInputs,
      expected_outputs: params.expectedOutputs,
      verification_steps: params.verificationSteps,
      rollback_instructions: params.rollbackInstructions,
      version: params.version,
      created_at: createdAt,
    };
  },

  findAll(): Skill[] {
    const db = getDB();
    const rows = db.prepare(`SELECT * FROM skills ORDER BY id`).all() as Array<{
      id: string;
      scope: string;
      triggers: string;
      required_inputs: string;
      expected_outputs: string;
      verification_steps: string;
      rollback_instructions: string;
      version: string;
      created_at: string;
    }>;
    
    return rows.map(row => ({
      id: row.id,
      scope: row.scope as 'execution' | 'verification' | 'policy',
      triggers: JSON.parse(row.triggers),
      required_inputs: JSON.parse(row.required_inputs),
      expected_outputs: JSON.parse(row.expected_outputs),
      verification_steps: JSON.parse(row.verification_steps),
      rollback_instructions: row.rollback_instructions,
      version: row.version,
      created_at: row.created_at,
    }));
  },

  findById(id: string): Skill | null {
    const db = getDB();
    const row = db.prepare(`SELECT * FROM skills WHERE id = ?`).get(id) as {
      id: string;
      scope: string;
      triggers: string;
      required_inputs: string;
      expected_outputs: string;
      verification_steps: string;
      rollback_instructions: string;
      version: string;
      created_at: string;
    } | undefined;
    
    if (!row) return null;
    
    return {
      id: row.id,
      scope: row.scope as 'execution' | 'verification' | 'policy',
      triggers: JSON.parse(row.triggers),
      required_inputs: JSON.parse(row.required_inputs),
      expected_outputs: JSON.parse(row.expected_outputs),
      verification_steps: JSON.parse(row.verification_steps),
      rollback_instructions: row.rollback_instructions,
      version: row.version,
      created_at: row.created_at,
    };
  },

  findByTrigger(category: SignalCategory): Skill[] {
    const all = this.findAll();
    return all.filter(skill => skill.triggers.includes(category));
  },

  validate(skill: Partial<Skill>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!skill.id) errors.push('Missing required field: id');
    if (!skill.scope) errors.push('Missing required field: scope');
    if (!skill.triggers || skill.triggers.length === 0) errors.push('Missing required field: triggers');
    if (!skill.rollback_instructions) errors.push('Missing required field: rollback_instructions');
    if (!skill.version) errors.push('Missing required field: version');
    
    // Check for duplicate ID
    const existing = this.findById(skill.id!);
    if (existing) errors.push(`Duplicate skill ID: ${skill.id}`);
    
    return { valid: errors.length === 0, errors };
  },
};
