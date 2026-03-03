# Intelligence Layer

The Intelligence Layer adds prediction, scoring, calibration, case retrieval, and perception signals to Requiem CLI workflows.

## What it does

- Stores explicit run predictions (`predict record`, `predict list`).
- Scores predictions against observed outcomes (`predict score`).
- Computes calibration bins and quality metrics (`calibrate show/export`).
- Surfaces prior solved cases (`cases suggest/show/export`).
- Computes deterministic telemetry signals and risk scores (`signals`, `risk`).

## What it does not do

- No paid APIs or hosted model dependencies.
- No automatic code application from cases.
- No non-deterministic confidence blending.
