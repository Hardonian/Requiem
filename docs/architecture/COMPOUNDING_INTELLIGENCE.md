# Compounding Intelligence Layer

## Current state baseline

Requiem already had deterministic run lifecycle, learning signals, drift analysis, and economic telemetry in CLI storage. This change adds explicit, versioned intelligence-loop artifacts so reliability can improve over time without changing base model quality.

## Target architecture

The compounding layer is a closed loop:

1. **Predict**: create explicit probability claims for each run.
2. **Score**: bind outcomes and proper scoring (Brier/log-loss).
3. **Calibrate**: aggregate by claim/model/promptset for confidence quality.
4. **Retrieve**: suggest prior solved cases from lexical + fingerprint fields.
5. **Perceive**: convert repo telemetry into risk signals that influence planning.

## Integration points

- **Before execution**: `predict record` creates run-level claims.
- **After execution**: `predict score` records append-only outcome rows.
- **Verification/replay**: calibration rebuilt from persisted predictions/outcomes.
- **Planning hints**: `signals compute` and `risk score` expose deterministic risk factors.

## Storage choices

- **Memory/DB path**: existing in-memory DB adapter is used for prediction table insertion.
- **File path**: append-only NDJSON in `.requiem/intelligence/*.ndjson` for predictions/outcomes/calibration/cases/signals.
- **Schema strategy**: zod-validated, versioned records (`v1`) for each dataset.


## HTTP API + dashboards

- API endpoints: `/api/intelligence/predictions`, `/api/intelligence/outcomes`, `/api/intelligence/calibration`, `/api/intelligence/cases`, `/api/intelligence/signals`.
- Dashboard pages: `/intelligence/calibration`, `/intelligence/verification`, `/intelligence/cases`, `/intelligence/signals`.
- Run details include panels for predictions/outcomes, similar cases, and risk signals.

## CI + policy gates

- Added verify scripts: `verify:metamorphic`, `verify:drift-suite` (fails on CRITICAL drift), `verify:intelligence`.
- Added scheduled workflow `.github/workflows/intelligence-nightly.yml`.
- Added confidence gate and case-reuse verification policy hooks with warn/deny behavior via env configuration.
