# Learning Gap Matrix

## Scope

This document inventories current learning/intelligence primitives and maps them against the requested Learning Funnel + Calibration Suite capabilities.

## Phase 0 Discovery Inventory

### 1) Existing intelligence schemas (drift/anomaly/econ/confidence)

#### Implemented now
- **Prediction / Outcome / Calibration v1 schemas** are already defined and validated in both CLI and ReadyLayer surfaces.
  - CLI library schemas: `PredictionSchema`, `OutcomeSchema`, `CalibrationAggregateSchema`.
  - ReadyLayer store schemas: `predictionSchema`, `outcomeSchema`, `calibrationSchema`.
- **Signal and case schemas** (for drift/anomaly-like intelligence signals) exist via `PerceptionSignalSchema` and `CaseRecordSchema`.
- **Confidence metrics** are implemented via deterministic calibration math (`ECE`, `MCE`, Brier, binning) in `packages/cli/src/lib/calibration.ts`.
- **Economic signal integration hooks** exist in case extraction flow (`scripts/extract-intelligence-cases.ts`) and are documented in compounding intelligence architecture.

#### Gaps
- Current prediction/outcome schemas are **run/claim oriented**, not CAS-first learning records keyed by model/weights/calibration artifacts.
- No first-class schemas for requested `ErrorRecord`, `WeightSet`, `CrossTabReport`, `ErrorBandForecast`, or `CountermeasureRule`.
- No Bayesian calibration schema payload with posterior/prior metadata.

### 2) Existing event types and receipt formats

#### Implemented now
- Core event/receipt primitives are present in OSS engine headers (`event_log.hpp`, `receipt.hpp`) and documented in protocol/primitive docs.
- Append-only and deterministic invariants are established in docs (`INVARIANTS.md`, protocol material).
- CLI/ReadyLayer flows already emit and consume deterministic NDJSON records for intelligence predictions/outcomes/calibration.

#### Gaps
- Learning artifacts are not yet consistently modeled as **Event → Artifact (CAS) → Receipt links** for prediction/outcome/error/calibration/weights lifecycle.
- No explicit learning-specific event taxonomy for prediction logged, outcome resolved, error computed, calibration trained, weight proposal opened/approved.

### 3) Existing proof pack types and proposal pipeline gates

#### Implemented now
- Proof dependency enforcement exists (`enforceProofDependencies`) and is documented in `docs/PROOF_DEPENDENCY_MODEL.md`.
- Review/proposal command surface exists in RL CLI (`rl review run|propose|open-pr|verify`) with replay-aware semantics.

#### Gaps
- No dedicated **weights_update proposal bundle contract** with mandatory holdout/MC MOE evidence.
- No explicit gating policy tying calibration/weights activation to replay simulation + human approval + proof pack attachment.

### 4) Existing datasets / test data foundry

#### Implemented now
- Deterministic foundry architecture and command surface are present (`foundry` and `dataset` commands, seeded generators, replay/validate runners).
- Built-in deterministic datasets include the required “first 10” policy/security/perf/trace suites:
  - `POL-TENANT-ISOLATION`
  - `POL-ROLE-ESCALATION`
  - `TOOL-SCHEMA-STRESS`
  - `ADV-INJECT-BASIC`
  - `ADV-PATH-TRAVERSAL`
  - `REPO-DAG-CIRCULAR`
  - `CLI-PIPE-PRESSURE`
  - `PERF-COLD-START`
  - `FAULT-OOM-SCENARIO`
  - `TRACE-ROUNDTRIP`
- Nightly and smoke workflows exist for foundry and intelligence/calibration.

#### Gaps
- No synthetic learning datasets purpose-built for regression/classification calibration studies (e.g., controllable drift injection + known optimal corrective mapping for MOE assertions).
- No explicit dataset manifest fields for learning-funnel artifacts (weights/calibration provenance linkage).

### 5) Existing visuals generation utilities

#### Implemented now
- Calibration verification script exports machine-readable artifacts (`calibration_report.json`, `calibration_curves.csv`).
- CLI and docs support graph outputs (e.g., DOT for lineage/state), and ReadyLayer has intelligence calibration pages.

#### Gaps
- No canonical visual artifact generator for:
  - reliability diagrams
  - calibration curves as SVG/HTML artifacts
  - error-band charts
  - drift heatmaps
  - MOE before/after comparison panels attached to proof packs.

### 6) Existing cron/background job runners

#### Implemented now
- Scheduled workflows exist for:
  - calibration nightly
  - intelligence nightly
  - foundry nightly
  - CI scheduled verification lanes
- Intelligence extraction and calibration verification jobs are already scripted.

#### Gaps
- Missing deterministic background jobs for:
  - outcome→error record materialization
  - Monte Carlo / bootstrap error-band generation
  - countermeasure rule evaluation and action emission
  - periodic crosstab rollups for dashboard windows.

## Gap Matrix (Exists vs Missing)

| Capability | Current State | Gap Severity | Notes |
|---|---|---:|---|
| Prediction events | Partial | High | Implemented as NDJSON prediction rows, but not CAS-addressed `prediction_event_v1` linked through kernel append-only event chain. |
| Outcome events | Partial | High | Outcome recording exists; missing CAS-first `outcome_event_v1` + daemon POST route for write path in learning namespace. |
| Error records | Missing | High | No canonical `error_record_v1` artifact or deterministic outcome resolution job producing MAE/RMSE/logloss/ECE components per prediction. |
| Weight sets | Missing | Critical | No deterministic trainer + `weights_v1` artifact + proposal-gated activation flow. |
| Calibration models (Platt/Isotonic/Bayesian) | Partial | Critical | Calibration metrics exist; no train/apply artifact contract for platt/isotonic/beta posterior models. |
| Crosstabs | Missing | High | No `crosstab_v1` artifact and no API/CLI report generator for requested dimensions/metrics. |
| Error-band forecasting | Missing | Critical | No `error_band_v1`, no bootstrap/MC summary distribution artifacts. |
| Monte Carlo validation | Missing | Critical | No deterministic MC harness with seeded resampling and gating thresholds. |
| Drift-aware gating countermeasures | Partial | High | Drift/intelligence signals exist, but no deterministic countermeasure rule engine with reversible actions and proposal constraints. |
| Proof pack / proposal integration for learning activation | Partial | High | Generic review/proof hooks exist; learning-specific required evidence bundle and gates are not yet wired. |

## Recommended Implementation Order (from this baseline)

1. **Introduce canonical CAS-first learning schemas** (`prediction_event_v1`, `outcome_event_v1`, `error_record_v1`, `weights_v1`, `calibration_v1`, `crosstab_v1`, `error_band_v1`, `countermeasure_rule_v1`).
2. **Wire deterministic lifecycle jobs**: outcome ingestion → error computation → calibration/train/eval artifacts.
3. **Add calibration trainers** (platt/isotonic/bayesian-beta) and deterministic apply path with receipt references.
4. **Build holdout + MC harness** and enforce MOE reduction gate for activation proposals.
5. **Implement crosstab + dashboard artifacts** and expose operator routes/CLI.
6. **Finalize proposal integration** so activation remains human-gated with replay+proof evidence.

## Definition of “done” for this initiative

A run can emit prediction and outcome artifacts, deterministically compute errors, train/calibrate deterministic candidate models, generate crosstab + error-band artifacts, prove MOE delta on holdout+MC, package everything into proof packs, and only activate through proposal approval with replay parity checks.
