import assert from 'node:assert/strict';
import {
  casPut,
  computeErrors,
  generateCrossTabs,
  logPrediction,
  addOutcome,
  trainWeights,
  evaluateMoeGateFromHistory,
  proposeWeightsActivation,
} from '../packages/cli/src/lib/learning-suite.js';

const tenant = `verify-tenant-${Date.now()}`;
const run = `run-${Date.now()}`;
const trace = `trace-${Date.now()}`;

for (let i = 0; i < 30; i += 1) {
  const pred = logPrediction({
    tenant_id: tenant,
    trace_id: `${trace}-${i}`,
    run_id: run,
    model_id: 'model-v',
    model_version: 'v1',
    features: { x: 1 + i / 100 },
    weights_version: 'w1',
    prediction: 0.3 + (i % 10) / 20,
    confidence: 0.2 + (i % 4) * 0.2,
  });
  addOutcome({
    tenant_id: tenant,
    prediction_event_cas: pred.predictionCas,
    trace_id: `${trace}-${i}`,
    actual: i % 3 === 0 ? 1 : 0,
    outcome_source: 'verify',
    outcome_refs: [],
  });
}

const err = computeErrors(tenant);
assert(err.count >= 20, `expected computed errors, got ${err.count}`);

const ct = generateCrossTabs(tenant, '30d');
assert(ct.reportCas.startsWith('cas:'), 'crosstab CAS missing');

const datasetCas = casPut([
  { id: 'd1', tenant_id: tenant, model_id: 'model-v', feature_key: 'x', feature_value: 1, raw_score: 0.2, predicted: 0.7, actual: 1, confidence: 0.7, ts: '2026-01-01T00:00:00.000Z' },
  { id: 'd2', tenant_id: tenant, model_id: 'model-v', feature_key: 'x', feature_value: 0.3, raw_score: 0.1, predicted: 0.4, actual: 0, confidence: 0.4, ts: '2026-01-02T00:00:00.000Z' },
]);
const trained = trainWeights({
  tenant_id: tenant,
  model_id: 'model-v',
  dataset_cas: datasetCas,
  seed: 42,
  learning_rate: 0.05,
  max_iters: 30,
});

const gate = evaluateMoeGateFromHistory({
  tenant_id: tenant,
  model_id: 'model-v',
  candidate_weights_cas: trained.weightsCas,
  seed: 42,
  holdout_percent: 20,
  mc_runs: 50,
});
assert(gate.gateCas.startsWith('cas:'), 'moe gate cas missing');
assert(gate.visuals.reliability_svg_cas.startsWith('cas:'), 'reliability visual missing');
assert(gate.visuals.error_band_svg_cas.startsWith('cas:'), 'error-band visual missing');
assert(gate.visuals.html_report_cas.startsWith('cas:'), 'html report visual missing');

const proposal = proposeWeightsActivation({
  tenant_id: tenant,
  model_id: 'model-v',
  weights_cas: trained.weightsCas,
  proof_refs: ['cas:proof'],
  replay_summary_cas: gate.replayCas,
  mc_bands_cas: 'cas:bands',
  moe_gate_cas: gate.gateCas,
});
assert(proposal.proposalCas.startsWith('cas:'), 'proposal cas missing');

console.log('verify-learning:ok');
