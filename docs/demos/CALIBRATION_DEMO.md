# Calibration Demo

## Commands
```bash
pnpm verify:calibration
reach calibration compute --window all --tenant demo
reach calibration show --tenant demo
```

## Expected outputs
- `verify:calibration` writes:
  - `artifacts/calibration/calibration_report.json`
  - `artifacts/calibration/calibration_curves.csv`
- `reach calibration show` prints table columns:
  `claim_type | model | window | n | avg_brier | ece | mce | sharpness | status`

## Regression simulation
1. Insert deliberately bad outcomes (high `predicted_p`, repeated failures).
2. Recompute calibration.
3. Confirm emitted status includes `OVERCONFIDENT` or `REGRESSION`.
