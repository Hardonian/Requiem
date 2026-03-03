# Intelligence Runbook

## Daily operations

1. Record predictions at run start.
2. Score outcomes after tests/build finish.
3. Regenerate calibration summary.
4. Compute signals and review risk score for changed paths.

## Commands

```bash
requiem predict record --run run-123 --claim TESTS_PASS --p 0.72 --subject verify:ci
requiem predict list --run run-123
requiem predict score --run run-123 --observed 1
requiem calibrate show --claim TESTS_PASS
requiem calibrate export --claim TESTS_PASS --format csv
requiem signals compute --last 30d
requiem signals list --severity WARN
requiem risk score --paths packages/cli/src/commands/intelligence.ts,ready-layer/src/app
```


## HTTP endpoints (tenant-scoped via `x-tenant-id`)

- `GET /api/intelligence/predictions?run_id=<id>`
- `GET /api/intelligence/outcomes?run_id=<id>`
- `GET /api/intelligence/calibration?claim_type=TESTS_PASS&window=30d`
- `GET /api/intelligence/cases`
- `GET /api/intelligence/signals?severity=WARN`
