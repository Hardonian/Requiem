# Calibration Runbook

## Interpreting signals
- `OVERCONFIDENT`: model predicts too high vs observed frequency, or ECE above threshold.
- `UNDERCONFIDENT`: model predicts too low vs observed frequency.
- `REGRESSION`: Brier worse than both naive baselines by configured margin.

## Operational response
1. Run `pnpm verify:calibration` and inspect `artifacts/calibration/calibration_report.json`.
2. Run `reach calibration compute --window 30d --tenant <tenant>`.
3. Review `reach calibration show --json --tenant <tenant>`.
4. If regression persists, tighten confidence-gating policy and/or roll back promptset/model fingerprint.

## Tuning knobs
- `minSamples`
- `confidenceGapThreshold`
- `eceThreshold`
- `regressionMargin`

These are currently centralized in `CalibrationRepository.computeAndStoreMetrics()` and `scripts/verify-calibration.ts`.
