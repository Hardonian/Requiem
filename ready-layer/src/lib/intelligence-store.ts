import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const root = process.env.REQUIEM_INTELLIGENCE_STORE_DIR || path.join(process.cwd(), '.requiem/intelligence');

const claimType = z.enum([
  'TESTS_PASS',
  'BUILD_PASS',
  'BUDGET_WITHIN',
  'DRIFT_NONE',
  'POLICY_ALLOW',
  'LATENCY_P95_BELOW',
  'COST_P95_BELOW',
  'COST_WITHIN_BUDGET',
]);

export const predictionSchema = z.object({
  prediction_id: z.string().uuid(),
  run_id: z.string(),
  tenant_id: z.string(),
  actor_id: z.string(),
  created_at: z.string(),
  claim_type: claimType,
  subject: z.string(),
  p: z.number().min(0).max(1),
  rationale: z.string(),
  model_fingerprint: z.string().optional(),
  promptset_version: z.string().optional(),
  context_hash: z.string(),
  prediction_version: z.literal('v1'),
});

export const outcomeSchema = z.object({
  outcome_id: z.string().uuid(),
  prediction_id: z.string().uuid(),
  observed: z.union([z.literal(0), z.literal(1)]),
  observed_value: z.number().optional(),
  brier_score: z.number(),
  log_loss: z.number().optional(),
  finalized_at: z.string(),
  evidence: z.array(z.string()).default([]),
  outcome_version: z.literal('v1'),
});

export const calibrationSchema = z.object({
  tenant_id: z.string(),
  model_fingerprint: z.string(),
  promptset_version: z.string(),
  claim_type: claimType,
  count: z.number(),
  avg_brier: z.number(),
  sharpness: z.number(),
  bins: z.array(z.object({
    lower: z.number(),
    upper: z.number(),
    avg_predicted: z.number(),
    avg_observed: z.number(),
    count: z.number(),
  })),
  last_updated_at: z.string(),
  calibration_version: z.literal('v1'),
});

export type Prediction = z.infer<typeof predictionSchema>;
export type Outcome = z.infer<typeof outcomeSchema>;
export type Calibration = z.infer<typeof calibrationSchema>;

const calibrationWindowSchema = z.string().regex(/^(\d+)([dh])$/i, 'window must match <number><d|h>');

export function assertValidCalibrationWindow(window?: string): void {
  if (!window) return;
  calibrationWindowSchema.parse(window);
}

function parseWindowToMs(window?: string): number | null {
  if (!window) return null;
  assertValidCalibrationWindow(window);
  const match = window.match(/^(\d+)([dh])$/i);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  return unit === 'd' ? value * 24 * 60 * 60 * 1000 : value * 60 * 60 * 1000;
}

function readNdjson<T>(fileName: string): T[] {
  const filePath = path.join(root, fileName);
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export function getPredictions(tenantId: string, runId?: string): Prediction[] {
  return readNdjson<Prediction>('predictions.ndjson')
    .map((item) => predictionSchema.parse(item))
    .filter((item) => item.tenant_id === tenantId && (!runId || item.run_id === runId));
}

export function getOutcomes(tenantId: string, runId?: string): Outcome[] {
  const predictionIds = new Set(getPredictions(tenantId, runId).map((p) => p.prediction_id));
  return readNdjson<Outcome>('outcomes.ndjson')
    .map((item) => outcomeSchema.parse(item))
    .filter((item) => predictionIds.has(item.prediction_id));
}

export function getCalibration(tenantId: string, claimType?: string, window?: string): Calibration[] {
  const windowMs = parseWindowToMs(window);
  const cutoff = windowMs ? Date.now() - windowMs : null;

  return readNdjson<Calibration>('calibration.ndjson')
    .map((item) => calibrationSchema.parse(item))
    .filter((item) => {
      if (item.tenant_id !== tenantId) return false;
      if (claimType && item.claim_type !== claimType) return false;
      if (!cutoff) return true;
      const ts = Date.parse(item.last_updated_at);
      return Number.isFinite(ts) && ts >= cutoff;
    })
    .sort((a, b) => b.last_updated_at.localeCompare(a.last_updated_at));
}


const caseSchema = z.object({
  case_id: z.string().uuid(),
  tenant_id: z.string(),
  summary: z.string(),
  failing_command: z.string(),
  tests_passed: z.boolean(),
  build_passed: z.boolean(),
  cost_units: z.number(),
  created_at: z.string(),
  case_version: z.literal('v1'),
}).passthrough();

const signalSchema = z.object({
  signal_id: z.string().uuid(),
  tenant_id: z.string(),
  timestamp: z.string(),
  signal_type: z.string(),
  subject: z.string(),
  severity: z.enum(['INFO', 'WARN', 'CRITICAL']),
  value: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  signal_version: z.literal('v1'),
}).passthrough();

export type CaseRecord = z.infer<typeof caseSchema>;
export type SignalRecord = z.infer<typeof signalSchema>;

export function getCases(tenantId: string): CaseRecord[] {
  return readNdjson<CaseRecord>('cases.ndjson')
    .map((item) => caseSchema.parse(item))
    .filter((item) => item.tenant_id === tenantId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getSignals(tenantId: string, severity?: 'INFO' | 'WARN' | 'CRITICAL'): SignalRecord[] {
  return readNdjson<SignalRecord>('signals.ndjson')
    .map((item) => signalSchema.parse(item))
    .filter((item) => item.tenant_id === tenantId && (!severity || item.severity === severity))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
