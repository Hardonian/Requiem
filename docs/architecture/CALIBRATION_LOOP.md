# Calibration Loop Architecture

## Math
- Binary Brier: `(p - y)^2`, with `p in [0,1]`, `y in {0,1}`.
- Reliability bins: 10 equal-width bins over `p`.
- ECE: `sum_k (n_k / n) * |avg_p_k - freq_k|`.
- MCE: `max_k |avg_p_k - freq_k|`.
- Sharpness: `Var(p)`.

## Implemented loop
1. Outcome capture stores per-decision `calibration_delta`.
2. `CalibrationRepository.listSamples()` reconstructs `predicted_p` and deterministic sample order.
3. `computeCalibrationMetrics()` produces Brier, ECE, MCE, sharpness, reliability bins.
4. `detectCalibrationStatus()` classifies: `OK|OVERCONFIDENT|UNDERCONFIDENT|REGRESSION|INSUFFICIENT_DATA`.
5. Aggregates persist in `calibration_metrics`; emitted signals persist in `calibration_signals`.
6. CLI `reach calibration compute|show` exposes closed-loop operation.
7. CI `verify:calibration` writes deterministic artifacts and fails on defined degradations.

## Windows
- Supported windows: `7d`, `30d`, `all`.
- Aggregation order is deterministic: `created_at ASC, id ASC`.
