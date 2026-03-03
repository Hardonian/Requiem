export type ClaimType = 'TESTS_PASS' | 'BUILD_PASS' | 'BUDGET_WITHIN' | 'POLICY_ALLOW' | 'DRIFT_NONE';
export type WindowType = '7d' | '30d' | 'all';

export interface CalibrationSample {
  id: string;
  tenant_id: string;
  claim_type: string;
  model_fingerprint: string;
  promptset_version: string;
  predicted_p: number;
  outcome_y: 0 | 1;
  created_at: string;
}

export interface CalibrationBin {
  bin_index: number;
  bin_start: number;
  bin_end: number;
  count: number;
  avg_predicted_p: number;
  empirical_frequency: number;
  gap: number;
}

export interface CalibrationMetrics {
  n: number;
  mean_brier: number;
  ece: number;
  mce: number;
  sharpness: number;
  avg_predicted_p: number;
  empirical_frequency: number;
  baseline_brier_base_rate: number;
  baseline_brier_half: number;
  bins: CalibrationBin[];
}

export function clampProbability(p: number): number {
  if (Number.isNaN(p)) return 0;
  if (p < 0) return 0;
  if (p > 1) return 1;
  return p;
}

export function brierScore(p: number, y: 0 | 1): number {
  const pp = clampProbability(p);
  return (pp - y) ** 2;
}

function emptyBin(index: number): CalibrationBin {
  const start = index / 10;
  const end = (index + 1) / 10;
  return {
    bin_index: index,
    bin_start: start,
    bin_end: end,
    count: 0,
    avg_predicted_p: 0,
    empirical_frequency: 0,
    gap: 0,
  };
}

export function assignBin(p: number): number {
  const pp = clampProbability(p);
  if (pp === 1) return 9;
  return Math.floor(pp * 10);
}

export function computeCalibrationMetrics(samples: CalibrationSample[]): CalibrationMetrics {
  const ordered = [...samples].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const bins = Array.from({ length: 10 }, (_, i) => emptyBin(i));

  if (ordered.length === 0) {
    return {
      n: 0,
      mean_brier: 0,
      ece: 0,
      mce: 0,
      sharpness: 0,
      avg_predicted_p: 0,
      empirical_frequency: 0,
      baseline_brier_base_rate: 0,
      baseline_brier_half: 0.25,
      bins,
    };
  }

  const avgP = ordered.reduce((acc, s) => acc + s.predicted_p, 0) / ordered.length;
  const baseRate = ordered.reduce((acc, s) => acc + s.outcome_y, 0) / ordered.length;

  let totalBrier = 0;
  let totalHalf = 0;
  let totalBaseRate = 0;
  let sumY = 0;
  const varianceAcc = ordered.map((s) => (s.predicted_p - avgP) ** 2);

  for (const sample of ordered) {
    totalBrier += brierScore(sample.predicted_p, sample.outcome_y);
    totalHalf += brierScore(0.5, sample.outcome_y);
    totalBaseRate += brierScore(baseRate, sample.outcome_y);
    sumY += sample.outcome_y;

    const bin = bins[assignBin(sample.predicted_p)];
    bin.count += 1;
    bin.avg_predicted_p += sample.predicted_p;
    bin.empirical_frequency += sample.outcome_y;
  }

  let ece = 0;
  let mce = 0;
  for (const bin of bins) {
    if (bin.count === 0) continue;
    bin.avg_predicted_p /= bin.count;
    bin.empirical_frequency /= bin.count;
    bin.gap = bin.avg_predicted_p - bin.empirical_frequency;
    const absGap = Math.abs(bin.gap);
    ece += (bin.count / ordered.length) * absGap;
    if (absGap > mce) mce = absGap;
  }

  const sharpness = varianceAcc.reduce((acc, v) => acc + v, 0) / ordered.length;

  return {
    n: ordered.length,
    mean_brier: totalBrier / ordered.length,
    ece,
    mce,
    sharpness,
    avg_predicted_p: avgP,
    empirical_frequency: sumY / ordered.length,
    baseline_brier_base_rate: totalBaseRate / ordered.length,
    baseline_brier_half: totalHalf / ordered.length,
    bins,
  };
}

export type CalibrationStatus = 'OK' | 'OVERCONFIDENT' | 'UNDERCONFIDENT' | 'REGRESSION' | 'INSUFFICIENT_DATA';

export function detectCalibrationStatus(
  metrics: CalibrationMetrics,
  options: { minSamples: number; confidenceGapThreshold: number; eceThreshold: number; regressionMargin: number },
): CalibrationStatus {
  if (metrics.n < options.minSamples) return 'INSUFFICIENT_DATA';
  if (
    metrics.mean_brier > metrics.baseline_brier_base_rate + options.regressionMargin &&
    metrics.mean_brier > metrics.baseline_brier_half + options.regressionMargin
  ) {
    return 'REGRESSION';
  }
  if (metrics.avg_predicted_p - metrics.empirical_frequency > options.confidenceGapThreshold || metrics.ece > options.eceThreshold) {
    return 'OVERCONFIDENT';
  }
  if (metrics.empirical_frequency - metrics.avg_predicted_p > options.confidenceGapThreshold) {
    return 'UNDERCONFIDENT';
  }
  return 'OK';
}
