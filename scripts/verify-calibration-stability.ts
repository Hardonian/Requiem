import assert from 'node:assert/strict';
import { casPut, trainCalibration } from '../packages/cli/src/lib/learning-suite.js';
import learningStore from '../ready-layer/src/lib/learning-store.ts';
const { trainCalibrationFromDataset } = learningStore;

const rows = [
  { id: '1', tenant_id: 'verify-tenant', model_id: 'm', feature_key: 'x', feature_value: 1, raw_score: 0.2, predicted: 0.6, actual: 1, confidence: 0.6, ts: '2026-01-01T00:00:00.000Z' },
  { id: '2', tenant_id: 'verify-tenant', model_id: 'm', feature_key: 'x', feature_value: 1, raw_score: 0.7, predicted: 0.4, actual: 0, confidence: 0.4, ts: '2026-01-02T00:00:00.000Z' },
  { id: '3', tenant_id: 'verify-tenant', model_id: 'm', feature_key: 'x', feature_value: 1, raw_score: 0.8, predicted: 0.8, actual: 1, confidence: 0.8, ts: '2026-01-03T00:00:00.000Z' },
];

const dataset = casPut(rows);
const cli = trainCalibration({ tenant_id: 'verify-tenant', model_id: 'm', dataset_cas: dataset, method: 'platt', seed: 77 });
const cli2 = trainCalibration({ tenant_id: 'verify-tenant', model_id: 'm', dataset_cas: dataset, method: 'platt', seed: 77 });
assert.equal(cli.calibration.calibration_id, cli2.calibration.calibration_id, 'CLI platt calibration should be deterministic');

const route = trainCalibrationFromDataset({
  tenant_id: 'verify-tenant',
  model_id: 'm',
  method: 'platt',
  seed: 77,
  dataset_rows: rows.map((r) => ({ predicted: r.predicted, raw_score: r.raw_score, actual: r.actual })),
});
const route2 = trainCalibrationFromDataset({
  tenant_id: 'verify-tenant',
  model_id: 'm',
  method: 'platt',
  seed: 77,
  dataset_rows: rows.map((r) => ({ predicted: r.predicted, raw_score: r.raw_score, actual: r.actual })),
});
assert.equal(route.calibration_id, route2.calibration_id, 'Route platt calibration should be deterministic');
assert.deepEqual(route.params, route2.params, 'Route params must be stable');

const beta = trainCalibrationFromDataset({
  tenant_id: 'verify-tenant',
  model_id: 'm',
  method: 'bayesian_beta',
  dataset_rows: rows.map((r) => ({ predicted: r.predicted, raw_score: r.raw_score, actual: r.actual })),
});
assert(Array.isArray(beta.params.bins), 'Bayesian beta bins must be present');

console.log('verify-calibration-stability:ok');
