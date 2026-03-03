# Foundry Runbook

## Build datasets
- `node scripts/run-tsx.mjs packages/cli/src/cli.ts foundry generate`
- `node scripts/run-tsx.mjs packages/cli/src/cli.ts foundry git mine --limit 50 --seed 1`
- `node scripts/run-tsx.mjs packages/cli/src/cli.ts foundry metamorphic generate --base-suite core_vectors --per 5 --seed 1`

## Run datasets
- `node scripts/run-tsx.mjs packages/cli/src/cli.ts foundry vectors run --suite core --seeds 1,2,3`
- `FOUNDRY_FAULTS=1 node scripts/run-tsx.mjs packages/cli/src/cli.ts foundry faults run --dataset fault_injection_suite`

## Reports and export
- `node scripts/run-tsx.mjs packages/cli/src/cli.ts foundry report --last 1`
- `node scripts/run-tsx.mjs packages/cli/src/cli.ts foundry export --dataset core_vectors --format json`
- `node scripts/run-tsx.mjs packages/cli/src/cli.ts foundry export --dataset core_vectors --format csv`

## Fault safety
Fault scenarios are disabled by default and require `FOUNDRY_FAULTS=1`.

## Interpretation
- `PASS/FAIL` per item is persisted with `trace_id`.
- Run summary includes pass/fail counters and drift severity buckets.
- Logs/artifacts are under `artifacts/foundry/`.
