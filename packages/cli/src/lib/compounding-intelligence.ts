import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { getDB } from '../db/connection.js';

export const ClaimTypeSchema = z.enum([
  'TESTS_PASS',
  'BUILD_PASS',
  'BUDGET_WITHIN',
  'DRIFT_NONE',
  'POLICY_ALLOW',
  'LATENCY_P95_BELOW',
  'COST_P95_BELOW',
  'COST_WITHIN_BUDGET',
]);

export const PredictionSchema = z.object({
  prediction_id: z.string().uuid(),
  run_id: z.string().min(1),
  tenant_id: z.string().min(1),
  actor_id: z.string().min(1),
  created_at: z.string().datetime(),
  claim_type: ClaimTypeSchema,
  subject: z.string().min(1),
  p: z.number().min(0).max(1),
  rationale: z.string().min(1),
  model_fingerprint: z.string().optional(),
  promptset_version: z.string().optional(),
  context_hash: z.string().min(1),
  prediction_version: z.literal('v1'),
});

export const OutcomeSchema = z.object({
  outcome_id: z.string().uuid(),
  prediction_id: z.string().uuid(),
  observed: z.union([z.literal(0), z.literal(1)]),
  observed_value: z.number().optional(),
  brier_score: z.number().min(0).max(1),
  log_loss: z.number().min(0).optional(),
  finalized_at: z.string().datetime(),
  evidence: z.array(z.string()).default([]),
  outcome_version: z.literal('v1'),
});

export const CalibrationBinSchema = z.object({
  lower: z.number().min(0).max(1),
  upper: z.number().min(0).max(1),
  avg_predicted: z.number().min(0).max(1),
  avg_observed: z.number().min(0).max(1),
  count: z.number().int().min(0),
});

export const CalibrationAggregateSchema = z.object({
  tenant_id: z.string().min(1),
  model_fingerprint: z.string().default('unknown-model'),
  promptset_version: z.string().default('unknown-promptset'),
  claim_type: ClaimTypeSchema,
  count: z.number().int().min(0),
  avg_brier: z.number().min(0).max(1),
  sharpness: z.number().min(0).max(1),
  bins: z.array(CalibrationBinSchema),
  last_updated_at: z.string().datetime(),
  calibration_version: z.literal('v1'),
});

export const CaseRecordSchema = z.object({
  case_id: z.string().uuid(),
  tenant_id: z.string().min(1),
  created_at: z.string().datetime(),
  error_hash: z.string().min(1),
  failing_command: z.string().min(1),
  affected_paths: z.array(z.string()),
  route_or_feature: z.string().min(1),
  policy_context_signature: z.string().min(1),
  diff_signature: z.string().min(1),
  files_changed: z.array(z.string()),
  summary: z.string().min(1),
  tests_passed: z.boolean(),
  build_passed: z.boolean(),
  deploy_passed: z.boolean(),
  cost_units: z.number().nonnegative(),
  run_id: z.string().min(1),
  pointers: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  case_version: z.literal('v1'),
});

export const SignalTypeSchema = z.enum([
  'FLAKY_TEST', 'HOTSPOT_PATH', 'HIGH_CHURN_AREA', 'DEP_LOCKFILE_CHANGE', 'ROUTE_500_RATE', 'COST_REGRESSION', 'DRIFT_INCREASE',
]);
export const SignalSeveritySchema = z.enum(['INFO', 'WARN', 'CRITICAL']);

export const PerceptionSignalSchema = z.object({
  signal_id: z.string().uuid(),
  tenant_id: z.string().min(1),
  timestamp: z.string().datetime(),
  signal_type: SignalTypeSchema,
  subject: z.string().min(1),
  severity: SignalSeveritySchema,
  value: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  evidence: z.array(z.string()).default([]),
  signal_version: z.literal('v1'),
});

export type Prediction = z.infer<typeof PredictionSchema>;
export type Outcome = z.infer<typeof OutcomeSchema>;
export type CalibrationAggregate = z.infer<typeof CalibrationAggregateSchema>;
export type CaseRecord = z.infer<typeof CaseRecordSchema>;
export type PerceptionSignal = z.infer<typeof PerceptionSignalSchema>;

const storeRoot = process.env.REQUIEM_INTELLIGENCE_STORE_DIR || '.requiem/intelligence';
function fileFor(name: string): string {
  return path.join(storeRoot, `${name}.ndjson`);
}
function appendNdjson(name: string, record: unknown): void {
  fs.mkdirSync(storeRoot, { recursive: true });
  fs.appendFileSync(fileFor(name), `${JSON.stringify(record)}\n`, 'utf8');
}
function readNdjson<T>(name: string): T[] {
  const f = fileFor(name);
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as T);
}

export function deriveContextHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function brierScore(p: number, observed: 0 | 1): number {
  const d = p - observed;
  return Number((d * d).toFixed(6));
}

export const IntelligenceRepository = {
  createPrediction(input: Omit<Prediction, 'prediction_id' | 'created_at' | 'prediction_version'>): Prediction {
    const prediction: Prediction = PredictionSchema.parse({
      ...input,
      prediction_id: randomUUID(),
      created_at: new Date().toISOString(),
      prediction_version: 'v1',
    });
    appendNdjson('predictions', prediction);
    const db = getDB();
    db.exec('CREATE TABLE IF NOT EXISTS predictions (prediction_id TEXT, run_id TEXT, tenant_id TEXT, actor_id TEXT, created_at TEXT, claim_type TEXT, subject TEXT, p REAL, rationale TEXT, model_fingerprint TEXT, promptset_version TEXT, context_hash TEXT, prediction_version TEXT)');
    db.prepare('INSERT INTO predictions (prediction_id, run_id, tenant_id, actor_id, created_at, claim_type, subject, p, rationale, model_fingerprint, promptset_version, context_hash, prediction_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(prediction.prediction_id, prediction.run_id, prediction.tenant_id, prediction.actor_id, prediction.created_at, prediction.claim_type, prediction.subject, prediction.p, prediction.rationale, prediction.model_fingerprint ?? null, prediction.promptset_version ?? null, prediction.context_hash, prediction.prediction_version);
    return prediction;
  },

  listPredictions(runId: string): Prediction[] {
    return readNdjson<Prediction>('predictions').filter((row) => row.run_id === runId).map((row) => PredictionSchema.parse(row));
  },

  recordOutcome(input: { prediction: Prediction; observed: 0 | 1; observedValue?: number; evidence?: string[] }): Outcome {
    const outcome: Outcome = OutcomeSchema.parse({
      outcome_id: randomUUID(),
      prediction_id: input.prediction.prediction_id,
      observed: input.observed,
      observed_value: input.observedValue,
      brier_score: brierScore(input.prediction.p, input.observed),
      log_loss: -Math.log(input.observed === 1 ? Math.max(input.prediction.p, 1e-6) : Math.max(1 - input.prediction.p, 1e-6)),
      finalized_at: new Date().toISOString(),
      evidence: input.evidence ?? [],
      outcome_version: 'v1',
    });
    appendNdjson('outcomes', outcome);
    return outcome;
  },

  listOutcomesForRun(runId: string): Outcome[] {
    const predictions = this.listPredictions(runId);
    const predictionIds = new Set(predictions.map((row) => row.prediction_id));
    return readNdjson<Outcome>('outcomes').filter((row) => predictionIds.has(row.prediction_id)).map((row) => OutcomeSchema.parse(row));
  },

  buildCalibration(tenantId: string, claimType: z.infer<typeof ClaimTypeSchema>): CalibrationAggregate {
    const predictions = readNdjson<Prediction>('predictions').filter((row) => row.tenant_id === tenantId && row.claim_type === claimType);
    const outcomes = readNdjson<Outcome>('outcomes');
    const byPrediction = new Map(outcomes.map((row) => [row.prediction_id, row]));
    const scored = predictions.map((p) => ({ p, o: byPrediction.get(p.prediction_id) })).filter((row) => row.o);
    const count = scored.length;
    const avgBrier = count === 0 ? 0 : scored.reduce((sum, row) => sum + row.o!.brier_score, 0) / count;
    const sharpness = count === 0 ? 0 : scored.reduce((sum, row) => sum + Math.abs(row.p.p - 0.5), 0) / count;

    const bins: CalibrationAggregate['bins'] = Array.from({ length: 10 }, (_, idx) => {
      const lower = idx / 10;
      const upper = (idx + 1) / 10;
      const inBin = scored.filter((row) => row.p.p >= lower && (idx === 9 ? row.p.p <= upper : row.p.p < upper));
      const avgPredicted = inBin.length ? inBin.reduce((s, row) => s + row.p.p, 0) / inBin.length : 0;
      const avgObserved = inBin.length ? inBin.reduce((s, row) => s + row.o!.observed, 0) / inBin.length : 0;
      return { lower, upper, avg_predicted: avgPredicted, avg_observed: avgObserved, count: inBin.length };
    });

    const aggregate = CalibrationAggregateSchema.parse({
      tenant_id: tenantId,
      model_fingerprint: scored[0]?.p.model_fingerprint ?? 'unknown-model',
      promptset_version: scored[0]?.p.promptset_version ?? 'unknown-promptset',
      claim_type: claimType,
      count,
      avg_brier: Number(avgBrier.toFixed(6)),
      sharpness: Number(sharpness.toFixed(6)),
      bins,
      last_updated_at: new Date().toISOString(),
      calibration_version: 'v1',
    });
    appendNdjson('calibration', aggregate);
    return aggregate;
  },
};
