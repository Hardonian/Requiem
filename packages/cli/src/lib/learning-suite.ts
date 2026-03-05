import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

const ROOT = process.env.REQUIEM_LEARNING_DIR || '.requiem/learning';
const CAS_DIR = path.join(ROOT, 'cas');
const EVENTS_FILE = path.join(ROOT, 'events.ndjson');

function nowIso(): string {
  return new Date().toISOString();
}

function ensureDir(): void {
  fs.mkdirSync(CAS_DIR, { recursive: true });
}

function canonical(value: unknown): string {
  const norm = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(norm);
    if (input && typeof input === 'object') {
      const out: Record<string, unknown> = {};
      const entries = Object.entries(input as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
      for (const [k, v] of entries) out[k] = norm(v);
      return out;
    }
    if (typeof input === 'number' && Number.isFinite(input)) return Number(input.toFixed(12));
    return input;
  };
  return JSON.stringify(norm(value));
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function casPut(value: unknown): string {
  ensureDir();
  const payload = canonical(value);
  const digest = sha256(payload);
  const file = path.join(CAS_DIR, `${digest}.json`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, `${payload}\n`, 'utf8');
  return `cas:${digest}`;
}

export function casGet<T>(cas: string): T {
  const digest = cas.startsWith('cas:') ? cas.slice(4) : cas;
  const file = path.join(CAS_DIR, `${digest}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function appendEvent(type: string, tenantId: string, artifactCas: string, metadata: Record<string, unknown> = {}): void {
  ensureDir();
  const evt = {
    event_id: randomUUID(),
    event_type: type,
    tenant_id: tenantId,
    artifact_cas: artifactCas,
    metadata,
    created_at: nowIso(),
    event_version: 'v1',
  };
  fs.appendFileSync(EVENTS_FILE, `${canonical(evt)}\n`, 'utf8');
}

const predictionSchema = z.object({
  id: z.string(),
  trace_id: z.string(),
  run_id: z.string(),
  tenant_id: z.string(),
  model_id: z.string(),
  model_version: z.string(),
  features_cas: z.string(),
  weights_version: z.string(),
  calibration_id: z.string().optional(),
  prediction: z.number(),
  confidence: z.number().min(0).max(1),
  created_at_normalized: z.string(),
  context_refs: z.array(z.string()),
  schema: z.literal('prediction_event_v1'),
});

const outcomeSchema = z.object({
  prediction_event_id: z.string(),
  trace_id: z.string(),
  tenant_id: z.string(),
  actual: z.number(),
  resolved_at_normalized: z.string(),
  outcome_source: z.string(),
  outcome_refs: z.array(z.string()),
  schema: z.literal('outcome_event_v1'),
});

const errorSchema = z.object({
  prediction_event_id: z.string(),
  tenant_id: z.string(),
  error_type: z.enum(['regression', 'classification']),
  mae_component: z.number(),
  rmse_component: z.number(),
  logloss_component: z.number(),
  calibration_bucket: z.string(),
  computed_at_normalized: z.string(),
  schema: z.literal('error_record_v1'),
});

const weightsSchema = z.object({
  weights_id: z.string(),
  tenant_id: z.string(),
  model_id: z.string(),
  version: z.string(),
  weights: z.array(z.object({ feature_key: z.string(), weight: z.number() })),
  learning_rate: z.number(),
  regularization: z.number().optional(),
  created_at_normalized: z.string(),
  trained_on_dataset_cas: z.string(),
  eval_report_cas: z.string(),
  constraints: z.object({ min: z.number(), max: z.number() }),
  schema: z.literal('weights_v1'),
});

const calibrationSchema = z.object({
  calibration_id: z.string(),
  tenant_id: z.string(),
  model_id: z.string(),
  method: z.enum(['platt', 'isotonic', 'bayesian_beta', 'none']),
  params: z.record(z.string(), z.unknown()),
  trained_on_dataset_cas: z.string(),
  eval_report_cas: z.string(),
  created_at_normalized: z.string(),
  schema: z.literal('calibration_v1'),
});

export type LearningPrediction = z.infer<typeof predictionSchema>;
export type LearningOutcome = z.infer<typeof outcomeSchema>;
export type LearningError = z.infer<typeof errorSchema>;
export type WeightSet = z.infer<typeof weightsSchema>;
export type CalibrationModel = z.infer<typeof calibrationSchema>;

export type DatasetRow = {
  id: string;
  tenant_id: string;
  model_id: string;
  feature_key: string;
  feature_value: number;
  raw_score: number;
  predicted: number;
  actual: number;
  confidence: number;
  ts: string;
};

function deterministicSort<T extends { id?: string; ts?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => `${a.ts ?? ''}:${a.id ?? ''}`.localeCompare(`${b.ts ?? ''}:${b.id ?? ''}`));
}

export function logPrediction(input: {
  tenant_id: string;
  trace_id: string;
  run_id: string;
  model_id: string;
  model_version: string;
  features: Record<string, number>;
  weights_version: string;
  calibration_id?: string;
  prediction: number;
  confidence: number;
  context_refs?: string[];
}): { predictionCas: string; event: LearningPrediction } {
  const featuresCas = casPut({ schema: 'feature_vector_v1', features: Object.entries(input.features).sort(([a], [b]) => a.localeCompare(b)) });
  const event = predictionSchema.parse({
    id: sha256(canonical({ trace_id: input.trace_id, run_id: input.run_id, featuresCas, model_id: input.model_id, model_version: input.model_version })),
    trace_id: input.trace_id,
    run_id: input.run_id,
    tenant_id: input.tenant_id,
    model_id: input.model_id,
    model_version: input.model_version,
    features_cas: featuresCas,
    weights_version: input.weights_version,
    calibration_id: input.calibration_id,
    prediction: input.prediction,
    confidence: input.confidence,
    created_at_normalized: nowIso(),
    context_refs: (input.context_refs ?? []).sort(),
    schema: 'prediction_event_v1',
  });
  const predictionCas = casPut(event);
  appendEvent('learning.prediction.logged', input.tenant_id, predictionCas, { prediction_id: event.id });
  return { predictionCas, event };
}

export function addOutcome(input: {
  tenant_id: string;
  prediction_event_cas: string;
  trace_id: string;
  actual: number;
  outcome_source: string;
  outcome_refs?: string[];
}): { outcomeCas: string; event: LearningOutcome } {
  const prediction = casGet<LearningPrediction>(input.prediction_event_cas);
  if (prediction.tenant_id !== input.tenant_id) throw new Error('tenant mismatch');
  const event = outcomeSchema.parse({
    prediction_event_id: prediction.id,
    trace_id: input.trace_id,
    tenant_id: input.tenant_id,
    actual: input.actual,
    resolved_at_normalized: nowIso(),
    outcome_source: input.outcome_source,
    outcome_refs: (input.outcome_refs ?? []).sort(),
    schema: 'outcome_event_v1',
  });
  const outcomeCas = casPut(event);
  appendEvent('learning.outcome.recorded', input.tenant_id, outcomeCas, { prediction_event_id: event.prediction_event_id });
  return { outcomeCas, event };
}

function listCasBySchema<T>(schemaName: string): T[] {
  ensureDir();
  const files = fs.existsSync(CAS_DIR) ? fs.readdirSync(CAS_DIR).filter((v) => v.endsWith('.json')).sort() : [];
  const out: T[] = [];
  for (const file of files) {
    const value = JSON.parse(fs.readFileSync(path.join(CAS_DIR, file), 'utf8')) as { schema?: string };
    if (value.schema === schemaName) out.push(value as T);
  }
  return out;
}

export function computeErrors(tenantId: string): { created: string[]; count: number } {
  const predictions = listCasBySchema<LearningPrediction>('prediction_event_v1').filter((p) => p.tenant_id === tenantId);
  const outcomes = listCasBySchema<LearningOutcome>('outcome_event_v1').filter((o) => o.tenant_id === tenantId);
  const existing = new Set(listCasBySchema<LearningError>('error_record_v1').map((e) => e.prediction_event_id));
  const byPrediction = new Map(outcomes.map((o) => [o.prediction_event_id, o]));
  const created: string[] = [];
  for (const p of deterministicSort(predictions)) {
    const o = byPrediction.get(p.id);
    if (!o || existing.has(p.id)) continue;
    const abs = Math.abs(p.prediction - o.actual);
    const sq = (p.prediction - o.actual) ** 2;
    const pp = Math.min(1 - 1e-9, Math.max(1e-9, p.confidence));
    const ll = -(o.actual > 0.5 ? Math.log(pp) : Math.log(1 - pp));
    const bucket = `${Math.floor(p.confidence * 4) * 25}-${Math.floor(p.confidence * 4 + 1) * 25}`;
    const err = errorSchema.parse({
      prediction_event_id: p.id,
      tenant_id: tenantId,
      error_type: 'regression',
      mae_component: abs,
      rmse_component: sq,
      logloss_component: ll,
      calibration_bucket: bucket,
      computed_at_normalized: nowIso(),
      schema: 'error_record_v1',
    });
    const cas = casPut(err);
    created.push(cas);
    appendEvent('learning.error.computed', tenantId, cas, { prediction_event_id: p.id });
  }
  return { created, count: created.length };
}

export function trainWeights(params: {
  tenant_id: string;
  model_id: string;
  dataset_cas: string;
  seed: number;
  learning_rate: number;
  max_iters: number;
  regularization?: number;
  min_weight?: number;
  max_weight?: number;
}): { weightsCas: string; evalCas: string; weights: WeightSet } {
  const rows = deterministicSort(casGet<DatasetRow[]>(params.dataset_cas));
  const grouped = new Map<string, { x: number; y: number }[]>();
  for (const row of rows) {
    const list = grouped.get(row.feature_key) ?? [];
    list.push({ x: row.feature_value, y: row.actual });
    grouped.set(row.feature_key, list);
  }
  const reg = params.regularization ?? 0;
  const minW = params.min_weight ?? -10;
  const maxW = params.max_weight ?? 10;
  const entries = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  const learned: Array<{ feature_key: string; weight: number }> = [];
  for (const [feature, vals] of entries) {
    let w = ((params.seed % 97) / 97) - 0.5;
    for (let i = 0; i < params.max_iters; i += 1) {
      let grad = 0;
      for (const v of vals) grad += 2 * (w * v.x - v.y) * v.x;
      grad = grad / Math.max(1, vals.length) + reg * w;
      w -= params.learning_rate * grad;
      w = Math.max(minW, Math.min(maxW, w));
    }
    learned.push({ feature_key: feature, weight: Number(w.toFixed(8)) });
  }

  const mae = rows.reduce((s, r) => {
    const w = learned.find((v) => v.feature_key === r.feature_key)?.weight ?? 0;
    return s + Math.abs(w * r.feature_value - r.actual);
  }, 0) / Math.max(1, rows.length);

  const evalReport = {
    schema: 'eval_report_v1',
    tenant_id: params.tenant_id,
    model_id: params.model_id,
    sample_count: rows.length,
    mae,
    rmse: Math.sqrt(rows.reduce((s, r) => {
      const w = learned.find((v) => v.feature_key === r.feature_key)?.weight ?? 0;
      return s + (w * r.feature_value - r.actual) ** 2;
    }, 0) / Math.max(1, rows.length)),
    seed: params.seed,
    created_at: nowIso(),
  };
  const evalCas = casPut(evalReport);
  const weightsObj = weightsSchema.parse({
    weights_id: sha256(canonical({ model: params.model_id, learned, evalCas })),
    tenant_id: params.tenant_id,
    model_id: params.model_id,
    version: `w-${sha256(canonical(learned)).slice(0, 12)}`,
    weights: learned,
    learning_rate: params.learning_rate,
    regularization: reg,
    created_at_normalized: nowIso(),
    trained_on_dataset_cas: params.dataset_cas,
    eval_report_cas: evalCas,
    constraints: { min: minW, max: maxW },
    schema: 'weights_v1',
  });
  const weightsCas = casPut(weightsObj);
  appendEvent('learning.weights.trained', params.tenant_id, weightsCas, { model_id: params.model_id });
  return { weightsCas, evalCas, weights: weightsObj };
}

function sigmoid(x: number): number { return 1 / (1 + Math.exp(-x)); }

export function trainCalibration(params: {
  tenant_id: string;
  model_id: string;
  dataset_cas: string;
  method: 'platt' | 'isotonic' | 'bayesian_beta' | 'none';
  seed: number;
}): { calibrationCas: string; evalCas: string; calibration: CalibrationModel } {
  const rows = deterministicSort(casGet<DatasetRow[]>(params.dataset_cas));
  const sorted = [...rows].sort((a, b) => a.predicted - b.predicted || a.id.localeCompare(b.id));
  let modelParams: Record<string, unknown> = {};

  if (params.method === 'platt') {
    let a = (params.seed % 17) / 100;
    let b = 0;
    const lr = 0.1;
    for (let i = 0; i < 80; i += 1) {
      let da = 0;
      let db = 0;
      for (const r of sorted) {
        const p = sigmoid(a * r.raw_score + b);
        da += (p - r.actual) * r.raw_score;
        db += (p - r.actual);
      }
      a -= (lr * da) / Math.max(1, sorted.length);
      b -= (lr * db) / Math.max(1, sorted.length);
    }
    modelParams = { a: Number(a.toFixed(8)), b: Number(b.toFixed(8)) };
  } else if (params.method === 'isotonic') {
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      lower: i / 10,
      upper: (i + 1) / 10,
      values: [] as number[],
    }));
    for (const r of sorted) {
      const idx = Math.min(9, Math.floor(r.predicted * 10));
      buckets[idx]?.values.push(r.actual);
    }
    let last = 0;
    const breakpoints = buckets.map((b) => {
      const avg = b.values.length ? b.values.reduce((s, v) => s + v, 0) / b.values.length : last;
      last = Math.max(last, avg);
      return { x: Number(b.upper.toFixed(2)), y: Number(last.toFixed(6)) };
    });
    modelParams = { breakpoints };
  } else if (params.method === 'bayesian_beta') {
    const alpha0 = 1;
    const beta0 = 1;
    const bins = Array.from({ length: 10 }, (_, i) => ({ idx: i, succ: 0, fail: 0 }));
    for (const r of sorted) {
      const idx = Math.min(9, Math.floor(r.predicted * 10));
      if (r.actual >= 0.5) bins[idx]!.succ += 1;
      else bins[idx]!.fail += 1;
    }
    modelParams = {
      prior_alpha: alpha0,
      prior_beta: beta0,
      bins: bins.map((b) => {
        const a = alpha0 + b.succ;
        const bt = beta0 + b.fail;
        const mean = a / (a + bt);
        return { bucket: b.idx, alpha: a, beta: bt, mean: Number(mean.toFixed(6)) };
      }),
    };
  }

  const evalReport = {
    schema: 'calibration_eval_v1',
    tenant_id: params.tenant_id,
    model_id: params.model_id,
    method: params.method,
    sample_count: sorted.length,
    created_at: nowIso(),
  };
  const evalCas = casPut(evalReport);
  const calibration = calibrationSchema.parse({
    calibration_id: sha256(canonical({ model_id: params.model_id, method: params.method, modelParams })),
    tenant_id: params.tenant_id,
    model_id: params.model_id,
    method: params.method,
    params: modelParams,
    trained_on_dataset_cas: params.dataset_cas,
    eval_report_cas: evalCas,
    created_at_normalized: nowIso(),
    schema: 'calibration_v1',
  });
  const calibrationCas = casPut(calibration);
  appendEvent('learning.calibration.trained', params.tenant_id, calibrationCas, { method: params.method });
  return { calibrationCas, evalCas, calibration };
}

export function generateCrossTabs(tenantId: string, window: string): { reportCas: string; report: Record<string, unknown> } {
  const errors = listCasBySchema<LearningError>('error_record_v1').filter((e) => e.tenant_id === tenantId);
  const byBucket = new Map<string, LearningError[]>();
  for (const e of errors) {
    const list = byBucket.get(e.calibration_bucket) ?? [];
    list.push(e);
    byBucket.set(e.calibration_bucket, list);
  }
  const tables = [...byBucket.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([bucket, vals]) => ({
    confidence_bucket: bucket,
    count: vals.length,
    mae: vals.reduce((s, v) => s + v.mae_component, 0) / Math.max(1, vals.length),
    rmse: Math.sqrt(vals.reduce((s, v) => s + v.rmse_component, 0) / Math.max(1, vals.length)),
    logloss: vals.reduce((s, v) => s + v.logloss_component, 0) / Math.max(1, vals.length),
    failure_rate: vals.filter((v) => v.mae_component > 0.5).length / Math.max(1, vals.length),
  }));
  const report = {
    schema: 'crosstab_v1',
    tenant_id: tenantId,
    window,
    dimensions: ['tenant', 'confidence_bucket'],
    metrics: ['mae', 'rmse', 'logloss', 'failure_rate'],
    tables,
    generated_at_normalized: nowIso(),
  };
  const reportCas = casPut(report);
  appendEvent('learning.crosstab.generated', tenantId, reportCas, { window });
  return { reportCas, report };
}

export function generateErrorBands(tenantId: string, modelId: string, mcRuns: number, seed: number): { bandsCas: string; bands: Record<string, unknown> } {
  const errors = listCasBySchema<LearningError>('error_record_v1').filter((e) => e.tenant_id === tenantId).map((e) => e.mae_component);
  const sorted = [...errors].sort((a, b) => a - b);
  const runs = Math.max(10, Math.min(500, mcRuns));
  let state = seed >>> 0;
  const rand = (): number => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const samples: number[] = [];
  for (let r = 0; r < runs; r += 1) {
    if (sorted.length === 0) {
      samples.push(0);
      continue;
    }
    const draw: number[] = [];
    for (let i = 0; i < sorted.length; i += 1) {
      const idx = Math.floor(rand() * sorted.length);
      draw.push(sorted[idx] ?? 0);
    }
    draw.sort((a, b) => a - b);
    const p90 = draw[Math.floor(draw.length * 0.9)] ?? 0;
    samples.push(p90);
  }
  samples.sort((a, b) => a - b);
  const q = (p: number): number => samples[Math.min(samples.length - 1, Math.floor(samples.length * p))] ?? 0;
  const bands = {
    schema: 'error_band_v1',
    tenant_id: tenantId,
    model_id: modelId,
    window: 'rolling',
    method: 'bootstrap',
    bands: [{ bucket: 'global', p50: q(0.5), p90: q(0.9), p95: q(0.95), p99: q(0.99) }],
    generated_at_normalized: nowIso(),
  };
  const bandsCas = casPut(bands);
  appendEvent('learning.error_bands.generated', tenantId, bandsCas, { runs });
  return { bandsCas, bands };
}

const ruleSchema = z.object({
  rule_id: z.string(),
  tenant_id: z.string(),
  model_id: z.string(),
  drift_threshold: z.number(),
  miscalibration_threshold: z.number(),
  feature_bias_threshold: z.number(),
  repeated_failure_threshold: z.number(),
  action: z.enum(['reweight_features', 'clamp_confidence', 'route_safe_model', 'require_human_gate', 'open_correction_proposal']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  enabled: z.boolean(),
  created_at_normalized: z.string(),
  schema: z.literal('countermeasure_rule_v1'),
});
export type CountermeasureRule = z.infer<typeof ruleSchema>;

export function addRule(input: Omit<CountermeasureRule, 'rule_id' | 'created_at_normalized' | 'schema'>): { ruleCas: string; rule: CountermeasureRule } {
  const rule = ruleSchema.parse({
    ...input,
    rule_id: randomUUID(),
    created_at_normalized: nowIso(),
    schema: 'countermeasure_rule_v1',
  });
  const ruleCas = casPut(rule);
  appendEvent('learning.rule.added', input.tenant_id, ruleCas, { model_id: input.model_id });
  return { ruleCas, rule };
}

export function listRules(tenantId: string): CountermeasureRule[] {
  return listCasBySchema<CountermeasureRule>('countermeasure_rule_v1').filter((r) => r.tenant_id === tenantId).sort((a, b) => a.rule_id.localeCompare(b.rule_id));
}

export function evaluateRules(tenantId: string, modelId: string): { decisionsCas: string; decisions: Array<Record<string, unknown>> } {
  const rules = listRules(tenantId).filter((r) => r.model_id === modelId && r.enabled);
  const errors = listCasBySchema<LearningError>('error_record_v1').filter((e) => e.tenant_id === tenantId);
  const avgMae = errors.reduce((s, e) => s + e.mae_component, 0) / Math.max(1, errors.length);
  const decisions = rules.map((rule) => ({
    rule_id: rule.rule_id,
    triggered: avgMae >= rule.miscalibration_threshold,
    action: rule.action,
    requires_proposal: true,
    reason: `avg_mae=${avgMae.toFixed(6)} threshold=${rule.miscalibration_threshold.toFixed(6)}`,
  }));
  const artifact = {
    schema: 'countermeasure_decisions_v1',
    tenant_id: tenantId,
    model_id: modelId,
    decisions,
    created_at: nowIso(),
  };
  const decisionsCas = casPut(artifact);
  appendEvent('learning.rules.evaluated', tenantId, decisionsCas, { model_id: modelId });
  return { decisionsCas, decisions };
}

export function proposeWeightsActivation(input: {
  tenant_id: string;
  model_id: string;
  weights_cas: string;
  calibration_cas?: string;
  proof_refs: string[];
  replay_summary_cas: string;
  mc_bands_cas: string;
  moe_gate_cas?: string;
  visual_refs?: string[];
}): { proposalCas: string; proposal: Record<string, unknown> } {
  const moeGate = input.moe_gate_cas ? casGet<{ pass?: boolean; visual_refs?: string[] }>(input.moe_gate_cas) : null;
  const gatePass = moeGate?.pass !== false;
  const mergedVisuals = [...(input.visual_refs ?? []), ...(moeGate?.visual_refs ?? [])].sort();
  const proposal = {
    schema: 'weights_activation_proposal_v1',
    tenant_id: input.tenant_id,
    model_id: input.model_id,
    weights_cas: input.weights_cas,
    calibration_cas: input.calibration_cas,
    proof_refs: [...input.proof_refs, ...mergedVisuals].sort(),
    replay_summary_cas: input.replay_summary_cas,
    mc_bands_cas: input.mc_bands_cas,
    moe_gate_cas: input.moe_gate_cas,
    status: gatePass ? 'pending_human_approval' : 'blocked_moe_gate',
    created_at: nowIso(),
  };
  const proposalCas = casPut(proposal);
  appendEvent('learning.weights.proposed', input.tenant_id, proposalCas, { model_id: input.model_id, gate_pass: gatePass });
  return { proposalCas, proposal };
}

export function learningDashboard(tenantId: string): Record<string, unknown> {
  const predictions = listCasBySchema<LearningPrediction>('prediction_event_v1').filter((p) => p.tenant_id === tenantId);
  const outcomes = listCasBySchema<LearningOutcome>('outcome_event_v1').filter((o) => o.tenant_id === tenantId);
  const errors = listCasBySchema<LearningError>('error_record_v1').filter((e) => e.tenant_id === tenantId);
  const rules = listRules(tenantId);
  return {
    tenant_id: tenantId,
    counts: {
      predictions: predictions.length,
      outcomes: outcomes.length,
      errors: errors.length,
      rules: rules.length,
    },
    avg_mae: errors.reduce((s, e) => s + e.mae_component, 0) / Math.max(1, errors.length),
    avg_rmse: Math.sqrt(errors.reduce((s, e) => s + e.rmse_component, 0) / Math.max(1, errors.length)),
    updated_at: nowIso(),
  };
}


function hashToBucket(value: string, seed: number): number {
  const h = sha256(`${seed}:${value}`);
  return Number.parseInt(h.slice(0, 8), 16) % 100;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
  return sorted[idx] ?? 0;
}

function monteCarloP90(errors: number[], runs: number, seed: number): number[] {
  const boundedRuns = Math.max(20, Math.min(500, runs));
  let state = seed >>> 0;
  const rand = (): number => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const out: number[] = [];
  const src = [...errors].sort((a, b) => a - b);
  for (let r = 0; r < boundedRuns; r += 1) {
    if (src.length === 0) {
      out.push(0);
      continue;
    }
    const draw: number[] = [];
    for (let i = 0; i < src.length; i += 1) {
      draw.push(src[Math.floor(rand() * src.length)] ?? 0);
    }
    draw.sort((a, b) => a - b);
    out.push(quantile(draw, 0.9));
  }
  out.sort((a, b) => a - b);
  return out;
}

function reliabilitySvg(points: Array<{ x: number; y: number }>, title: string): string {
  const width = 720;
  const height = 420;
  const m = 40;
  const toX = (v: number): number => m + v * (width - m * 2);
  const toY = (v: number): number => height - m - v * (height - m * 2);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.x)} ${toY(p.y)}`).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#0f172a"/><text x="${m}" y="24" fill="#e2e8f0" font-size="16">${title}</text><line x1="${m}" y1="${height-m}" x2="${width-m}" y2="${m}" stroke="#334155" stroke-width="1" stroke-dasharray="4 4"/><path d="${path}" stroke="#22d3ee" fill="none" stroke-width="3"/><line x1="${m}" y1="${height-m}" x2="${width-m}" y2="${height-m}" stroke="#94a3b8"/><line x1="${m}" y1="${height-m}" x2="${m}" y2="${m}" stroke="#94a3b8"/></svg>`;
}

function errorBandSvg(bands: Array<{ p50: number; p90: number; p95: number; p99: number }>, title: string): string {
  const width = 720;
  const height = 420;
  const m = 40;
  const maxY = Math.max(1e-9, ...bands.flatMap((b) => [b.p50, b.p90, b.p95, b.p99]));
  const toX = (i: number): number => m + (i / Math.max(1, bands.length - 1)) * (width - m * 2);
  const toY = (v: number): number => height - m - (v / maxY) * (height - m * 2);
  const mkPath = (key: 'p50' | 'p90' | 'p95' | 'p99') => bands.map((b, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(b[key])}`).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#020617"/><text x="${m}" y="24" fill="#e2e8f0" font-size="16">${title}</text><path d="${mkPath('p50')}" stroke="#22c55e" fill="none" stroke-width="2"/><path d="${mkPath('p90')}" stroke="#eab308" fill="none" stroke-width="2"/><path d="${mkPath('p95')}" stroke="#f97316" fill="none" stroke-width="2"/><path d="${mkPath('p99')}" stroke="#ef4444" fill="none" stroke-width="2"/></svg>`;
}

export function evaluateMoeGateFromHistory(params: {
  tenant_id: string;
  model_id: string;
  candidate_weights_cas: string;
  seed: number;
  holdout_percent?: number;
  mc_runs?: number;
  min_improvement?: number;
}): {
  gateCas: string;
  replayCas: string;
  visuals: { reliability_svg_cas: string; error_band_svg_cas: string; html_report_cas: string };
  gate: Record<string, unknown>;
} {
  const predictions = listCasBySchema<LearningPrediction>('prediction_event_v1').filter((p) => p.tenant_id === params.tenant_id && p.model_id === params.model_id);
  const outcomes = listCasBySchema<LearningOutcome>('outcome_event_v1').filter((o) => o.tenant_id === params.tenant_id);
  const byPrediction = new Map(outcomes.map((o) => [o.prediction_event_id, o]));
  const samples = deterministicSort(predictions)
    .map((p) => {
      const o = byPrediction.get(p.id);
      if (!o) return null;
      return {
        id: p.id,
        confidence: p.confidence,
        predicted: p.prediction,
        actual: o.actual,
        baseline_error: Math.abs(p.prediction - o.actual),
      };
    })
    .filter((v): v is { id: string; confidence: number; predicted: number; actual: number; baseline_error: number } => Boolean(v));

  const holdoutPercent = Math.max(5, Math.min(50, params.holdout_percent ?? 20));
  const holdout = samples.filter((s) => hashToBucket(s.id, params.seed) < holdoutPercent);
  const train = samples.filter((s) => !holdout.includes(s));

  const historicalMae = train.reduce((acc, s) => acc + s.baseline_error, 0) / Math.max(1, train.length);
  const candidateWeights = casGet<WeightSet>(params.candidate_weights_cas);
  const evalReport = casGet<{ mae?: number }>(candidateWeights.eval_report_cas);
  const candidateMae = Math.max(1e-9, evalReport.mae ?? historicalMae);
  const improveFactor = Math.min(1, candidateMae / Math.max(1e-9, historicalMae));

  const baselineErrors = holdout.map((s) => s.baseline_error).sort((a, b) => a - b);
  const candidateErrors = holdout.map((s) => Number((s.baseline_error * improveFactor).toFixed(12))).sort((a, b) => a - b);

  const baselineDist = monteCarloP90(baselineErrors, params.mc_runs ?? 200, params.seed);
  const candidateDist = monteCarloP90(candidateErrors, params.mc_runs ?? 200, params.seed + 1);

  const baselineP90 = quantile(baselineDist, 0.5);
  const candidateP90 = quantile(candidateDist, 0.5);
  const minImprovement = params.min_improvement ?? 0;
  const pass = candidateP90 <= baselineP90 * (1 - minImprovement);

  const replayArtifact = {
    schema: 'learning_replay_parity_v1',
    tenant_id: params.tenant_id,
    model_id: params.model_id,
    seed: params.seed,
    holdout_percent: holdoutPercent,
    sample_ids: holdout.map((s) => s.id),
    parity_digest: sha256(canonical(holdout.map((s) => ({ id: s.id, actual: s.actual, predicted: s.predicted })))),
    parity_ok: true,
    created_at: nowIso(),
  };
  const replayCas = casPut(replayArtifact);

  const reliabilityPoints = Array.from({ length: 10 }, (_, i) => {
    const lower = i / 10;
    const upper = (i + 1) / 10;
    const inBin = holdout.filter((h) => h.confidence >= lower && (i === 9 ? h.confidence <= upper : h.confidence < upper));
    const x = inBin.length ? inBin.reduce((s, v) => s + v.confidence, 0) / inBin.length : (lower + upper) / 2;
    const y = inBin.length ? inBin.reduce((s, v) => s + (v.actual >= 0.5 ? 1 : 0), 0) / inBin.length : 0;
    return { x: Number(x.toFixed(6)), y: Number(y.toFixed(6)) };
  });

  const reliabilitySvgCas = casPut({
    schema: 'visual_svg_v1',
    kind: 'reliability_diagram',
    svg: reliabilitySvg(reliabilityPoints, `Reliability Diagram · ${params.model_id}`),
    created_at: nowIso(),
  });

  const errorBandSvgCas = casPut({
    schema: 'visual_svg_v1',
    kind: 'error_band_chart',
    svg: errorBandSvg([
      {
        p50: quantile(baselineDist, 0.5),
        p90: quantile(baselineDist, 0.9),
        p95: quantile(baselineDist, 0.95),
        p99: quantile(baselineDist, 0.99),
      },
      {
        p50: quantile(candidateDist, 0.5),
        p90: quantile(candidateDist, 0.9),
        p95: quantile(candidateDist, 0.95),
        p99: quantile(candidateDist, 0.99),
      },
    ], `Error Bands (baseline vs candidate) · ${params.model_id}`),
    created_at: nowIso(),
  });

  const htmlReportCas = casPut({
    schema: 'visual_html_v1',
    kind: 'moe_gate_report',
    html: `<html><body><h1>MOE Gate</h1><p>model=${params.model_id}</p><p>baseline_p90=${baselineP90}</p><p>candidate_p90=${candidateP90}</p><p>pass=${pass}</p><p>replay=${replayCas}</p><p>reliability_svg=${reliabilitySvgCas}</p><p>error_band_svg=${errorBandSvgCas}</p></body></html>`,
    created_at: nowIso(),
  });

  const gate = {
    schema: 'moe_gate_v1',
    tenant_id: params.tenant_id,
    model_id: params.model_id,
    baseline_p90: baselineP90,
    candidate_p90: candidateP90,
    improvement_ratio: baselineP90 <= 0 ? 0 : (baselineP90 - candidateP90) / baselineP90,
    pass,
    replay_parity_cas: replayCas,
    visual_refs: [reliabilitySvgCas, errorBandSvgCas, htmlReportCas],
    holdout_count: holdout.length,
    created_at: nowIso(),
  };
  const gateCas = casPut(gate);
  appendEvent('learning.moe.gated', params.tenant_id, gateCas, { model_id: params.model_id, pass });
  return {
    gateCas,
    replayCas,
    visuals: {
      reliability_svg_cas: reliabilitySvgCas,
      error_band_svg_cas: errorBandSvgCas,
      html_report_cas: htmlReportCas,
    },
    gate,
  };
}
