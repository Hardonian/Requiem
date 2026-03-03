import fs from 'node:fs';
import path from 'node:path';
import { computeCalibrationMetrics, detectCalibrationStatus, type CalibrationSample } from '../packages/cli/src/lib/calibration.js';

const outDir = path.join(process.cwd(), 'artifacts', 'calibration');
fs.mkdirSync(outDir, { recursive: true });

const samples: CalibrationSample[] = [
  { id: '1', tenant_id: 'tenant-foundry', claim_type: 'TESTS_PASS', model_fingerprint: 'model-a', promptset_version: 'v1', predicted_p: 0.8, outcome_y: 1, created_at: '2026-02-01T00:00:00.000Z' },
  { id: '2', tenant_id: 'tenant-foundry', claim_type: 'TESTS_PASS', model_fingerprint: 'model-a', promptset_version: 'v1', predicted_p: 0.7, outcome_y: 0, created_at: '2026-02-02T00:00:00.000Z' },
  { id: '3', tenant_id: 'tenant-foundry', claim_type: 'TESTS_PASS', model_fingerprint: 'model-a', promptset_version: 'v1', predicted_p: 0.6, outcome_y: 1, created_at: '2026-02-03T00:00:00.000Z' },
  { id: '4', tenant_id: 'tenant-foundry', claim_type: 'BUILD_PASS', model_fingerprint: 'model-a', promptset_version: 'v1', predicted_p: 0.9, outcome_y: 1, created_at: '2026-02-01T00:00:00.000Z' },
  { id: '5', tenant_id: 'tenant-foundry', claim_type: 'BUILD_PASS', model_fingerprint: 'model-a', promptset_version: 'v1', predicted_p: 0.6, outcome_y: 0, created_at: '2026-02-02T00:00:00.000Z' },
  { id: '6', tenant_id: 'tenant-foundry', claim_type: 'BUILD_PASS', model_fingerprint: 'model-a', promptset_version: 'v1', predicted_p: 0.65, outcome_y: 0, created_at: '2026-02-03T00:00:00.000Z' },
  { id: '7', tenant_id: 'tenant-foundry', claim_type: 'BUILD_PASS', model_fingerprint: 'model-a', promptset_version: 'v1', predicted_p: 0.6, outcome_y: 0, created_at: '2026-02-04T00:00:00.000Z' },
  { id: '8', tenant_id: 'tenant-foundry', claim_type: 'BUILD_PASS', model_fingerprint: 'model-a', promptset_version: 'v1', predicted_p: 0.85, outcome_y: 1, created_at: '2026-02-05T00:00:00.000Z' },
];

const groups = new Map<string, CalibrationSample[]>();
for (const sample of samples) {
  const k = `${sample.claim_type}|${sample.model_fingerprint}|${sample.promptset_version}`;
  groups.set(k, [...(groups.get(k) || []), sample]);
}

const report = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, values]) => {
  const metrics = computeCalibrationMetrics(values);
  const status = detectCalibrationStatus(metrics, { minSamples: 3, confidenceGapThreshold: 0.1, eceThreshold: 0.08, regressionMargin: 0.01 });
  const [claim_type, model_fingerprint, promptset_version] = key.split('|');
  return {
    tenant_id: 'tenant-foundry',
    claim_type,
    model_fingerprint,
    promptset_version,
    window: 'all',
    n: metrics.n,
    avg_brier: Number(metrics.mean_brier.toFixed(6)),
    ece: Number(metrics.ece.toFixed(6)),
    mce: Number(metrics.mce.toFixed(6)),
    sharpness: Number(metrics.sharpness.toFixed(6)),
    baseline_brier_base_rate: Number(metrics.baseline_brier_base_rate.toFixed(6)),
    baseline_brier_half: Number(metrics.baseline_brier_half.toFixed(6)),
    status,
    bins: metrics.bins,
  };
});

const reportPath = path.join(outDir, 'calibration_report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');

const csvRows = ['claim_type,bin_index,count,avg_predicted_p,empirical_frequency,gap'];
for (const row of report) {
  for (const bin of row.bins) {
    csvRows.push(`${row.claim_type},${bin.bin_index},${bin.count},${bin.avg_predicted_p.toFixed(6)},${bin.empirical_frequency.toFixed(6)},${bin.gap.toFixed(6)}`);
  }
}
const csvPath = path.join(outDir, 'calibration_curves.csv');
fs.writeFileSync(csvPath, csvRows.join('\n') + '\n');

const baselinePath = path.join(outDir, 'baseline.json');
if (fs.existsSync(baselinePath)) {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as typeof report;
  for (const current of report) {
    const prev = baseline.find((b) => b.claim_type === current.claim_type);
    if (!prev) continue;
    if (current.avg_brier > prev.avg_brier * 1.15) {
      throw new Error(`Brier degraded >15% for ${current.claim_type}`);
    }
    if (current.ece > Math.max(prev.ece + 0.05, 0.2)) {
      throw new Error(`ECE degraded for ${current.claim_type}`);
    }
    if (current.status === 'REGRESSION') {
      throw new Error(`Critical calibration regression for ${current.claim_type}`);
    }
  }
}

console.log(`calibration report: ${reportPath}`);
console.log(`calibration curves: ${csvPath}`);
