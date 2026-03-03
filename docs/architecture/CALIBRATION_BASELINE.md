# Calibration Baseline Audit

## Inventory
- Prediction source: `packages/cli/src/commands/decide.ts` computes implicit prediction score from ranking via `getPredictedScore()`, then records `calibration_delta = actual - predicted` in `handleOutcome`. 
- Outcome source: `decide outcome --id ... --status success|failure|mixed` updates `decisions.outcome_status` and `calibration_delta`.
- Existing aggregate: `CalibrationRepository.getAverageDelta()` in `packages/cli/src/db/decisions.ts` averages recent deltas and feeds `handleEvaluate()` as `weights.calibration_bias`.
- Existing storage: `decisions` table in SQLite (in-memory and persisted providers).
- Existing surfaces:
  - CLI: `reach decide evaluate|explain|outcome|list|show`.
  - API: `/api/decisions` stub route in `ready-layer`.
  - UI: console decisions page exists, no dedicated calibration dashboard yet.

## Correctness check
- Brier formula baseline: not previously implemented.
- Current signal (`calibration_delta`) captures signed error, not proper scoring rule magnitude.
- Edge cases observed:
  - Mixed outcomes mapped to 0.5 and retained as delta only.
  - Missing outcomes are excluded from `getAverageDelta()` due to `calibration_delta IS NOT NULL`.
  - Duplicate predictions are not deduplicated; deterministic ordering now enforced in new aggregation by `(created_at, id)`.

## Baseline conclusions
- System had a feedback path, but lacked:
  - Brier/ECE/MCE/sharpness metrics.
  - Time-windowed deterministic calibration aggregates.
  - Explicit over/underconfidence and regression signals.
  - Verify gate for calibration degradation.
