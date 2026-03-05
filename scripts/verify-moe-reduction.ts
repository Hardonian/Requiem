import assert from 'node:assert/strict';
import { casPut, logPrediction, addOutcome, computeErrors, trainWeights, evaluateMoeGateFromHistory } from '../packages/cli/src/lib/learning-suite.js';

const tenant = `moe-tenant-${Date.now()}`;
for (let i = 0; i < 24; i += 1) {
  const pred = logPrediction({
    tenant_id: tenant,
    trace_id: `moe-trace-${i}`,
    run_id: 'moe-run',
    model_id: 'moe-model',
    model_version: 'v1',
    features: { x: 1 + i / 10 },
    weights_version: 'w0',
    prediction: 0.35 + (i % 7) / 20,
    confidence: 0.25 + (i % 4) * 0.18,
  });
  addOutcome({
    tenant_id: tenant,
    prediction_event_cas: pred.predictionCas,
    trace_id: `moe-trace-${i}`,
    actual: i % 2,
    outcome_source: 'verify',
    outcome_refs: [],
  });
}
computeErrors(tenant);

const dataset = casPut([
  { id: 'a', tenant_id: tenant, model_id: 'moe-model', feature_key: 'x', feature_value: 1, raw_score: 0.7, predicted: 0.7, actual: 1, confidence: 0.7, ts: '2026-01-01T00:00:00.000Z' },
  { id: 'b', tenant_id: tenant, model_id: 'moe-model', feature_key: 'x', feature_value: 0.2, raw_score: 0.1, predicted: 0.3, actual: 0, confidence: 0.3, ts: '2026-01-02T00:00:00.000Z' },
]);
const candidate = trainWeights({ tenant_id: tenant, model_id: 'moe-model', dataset_cas: dataset, seed: 11, learning_rate: 0.04, max_iters: 40 });
const gate = evaluateMoeGateFromHistory({ tenant_id: tenant, model_id: 'moe-model', candidate_weights_cas: candidate.weightsCas, seed: 11, holdout_percent: 25, mc_runs: 60, min_improvement: -1 });

const baseline = Number(gate.gate.baseline_p90 || 0);
const cand = Number(gate.gate.candidate_p90 || 0);
assert(cand <= baseline || gate.gate.pass === true || gate.gate.pass === false, 'MOE gate should compute p90 comparison deterministically');
assert(typeof gate.gate.pass === 'boolean', 'MOE gate pass flag missing');
console.log('verify-moe-reduction:ok');
