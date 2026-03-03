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


## Case extraction job

- Run manually: `pnpm intelligence:extract-cases`
- Nightly workflow also runs extraction to keep `cases.ndjson` populated from successful fix runs.

## Calibration windows

`/api/intelligence/calibration` now applies real server-side time slicing from `window=<Nd|Nh>` against `last_updated_at` (for example `30d`, `72h`).


## Verification gates

- `pnpm verify:calibration-window` fails if invalid calibration window formats are accepted.
- ReadyLayer e2e handler tests run with middleware-auth fixtures in `ready-layer/tests/intelligence-route-e2e.test.ts`.


## Cases dashboard fields

`/intelligence/cases` now displays extracted `cost_units` and artifact/evidence pointers per case row.


## Extraction regression fixtures

- Synthetic fixture set lives in `ready-layer/tests/fixtures/intelligence/extraction/` with:
  - `economic_events.ndjson`
  - `artifacts.ndjson`
- Regression test `ready-layer/tests/intelligence-extraction-regression.test.ts` validates extracted `cost_units` and pointer enrichment from these fixtures.

## Pointer badges

`/intelligence/cases` renders pointer-type badges for `run`, `artifact`, and `evidence` entries to improve operator scan speed.
