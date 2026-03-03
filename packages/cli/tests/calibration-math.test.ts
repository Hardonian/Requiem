import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignBin, brierScore, computeCalibrationMetrics, detectCalibrationStatus } from '../src/lib/calibration.js';

test('brier score known examples', () => {
  assert.equal(brierScore(1, 1), 0);
  assert.equal(brierScore(0, 1), 1);
  assert.ok(Math.abs(brierScore(0.8, 1) - 0.04) < 1e-12);
  assert.ok(Math.abs(brierScore(0.2, 0) - 0.04) < 1e-12);
});

test('bin assignment edges are deterministic', () => {
  assert.equal(assignBin(0), 0);
  assert.equal(assignBin(0.1), 1);
  assert.equal(assignBin(0.999999), 9);
  assert.equal(assignBin(1), 9);
});

test('metrics deterministic across input order', () => {
  const samples = [
    { id: '2', tenant_id: 't1', claim_type: 'TESTS_PASS', model_fingerprint: 'm', promptset_version: 'p', predicted_p: 0.9, outcome_y: 0 as const, created_at: '2026-01-02T00:00:00.000Z' },
    { id: '1', tenant_id: 't1', claim_type: 'TESTS_PASS', model_fingerprint: 'm', promptset_version: 'p', predicted_p: 0.8, outcome_y: 1 as const, created_at: '2026-01-01T00:00:00.000Z' },
  ];
  const a = computeCalibrationMetrics(samples);
  const b = computeCalibrationMetrics([...samples].reverse());
  assert.deepEqual(a, b);
});

test('status detection catches overconfidence and regression', () => {
  const overconfident = computeCalibrationMetrics([
    { id: '1', tenant_id: 't1', claim_type: 'TESTS_PASS', model_fingerprint: 'm', promptset_version: 'p', predicted_p: 0.95, outcome_y: 0, created_at: '2026-01-01T00:00:00.000Z' },
    { id: '2', tenant_id: 't1', claim_type: 'TESTS_PASS', model_fingerprint: 'm', promptset_version: 'p', predicted_p: 0.95, outcome_y: 0, created_at: '2026-01-02T00:00:00.000Z' },
    { id: '3', tenant_id: 't1', claim_type: 'TESTS_PASS', model_fingerprint: 'm', promptset_version: 'p', predicted_p: 0.95, outcome_y: 1, created_at: '2026-01-03T00:00:00.000Z' },
    { id: '4', tenant_id: 't1', claim_type: 'TESTS_PASS', model_fingerprint: 'm', promptset_version: 'p', predicted_p: 0.95, outcome_y: 0, created_at: '2026-01-04T00:00:00.000Z' },
    { id: '5', tenant_id: 't1', claim_type: 'TESTS_PASS', model_fingerprint: 'm', promptset_version: 'p', predicted_p: 0.95, outcome_y: 0, created_at: '2026-01-05T00:00:00.000Z' },
  ]);
  assert.equal(detectCalibrationStatus(overconfident, { minSamples: 5, confidenceGapThreshold: 0.1, eceThreshold: 0.08, regressionMargin: 0.01 }), 'REGRESSION');
});
