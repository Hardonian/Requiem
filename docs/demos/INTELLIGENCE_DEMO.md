# Intelligence Demo

## CLI demo script

```bash
requiem predict record --run demo-run --claim TESTS_PASS --p 0.8 --subject verify:intelligence
requiem predict list --run demo-run
requiem predict score --run demo-run --observed 1
requiem calibrate show --claim TESTS_PASS
requiem signals compute --last 30d
requiem risk score --paths packages/cli/src/lib/compounding-intelligence.ts
```

## Expected outputs

- Prediction row with `prediction_version: v1`
- Outcome row with `brier_score`
- Calibration aggregate with `bins[0..9]`
- Signal row with `signal_version: v1`
- Risk output with score and factor breakdown
