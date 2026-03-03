# Requiem Demo Fixtures

Deterministic fixtures for the vertical slice demo.

## Files

| File | Purpose | Contract |
|------|---------|----------|
| `policy.json` | Policy rules for demo execution | Policy schema v1 |
| `plan.json` | Two-step execution plan | Plan schema v1 |
| `input.json` | Sample request context | Request context |

## Determinism Guarantees

All fixtures are designed for deterministic execution:

1. **Fixed timestamps** — All `created_at` fields are hardcoded
2. **No randomness** — No UUIDs or random values
3. **Stable ordering** — Array elements in fixed order
4. **Minimal environment** — `env_allowlist: []` for isolation

## Quick Demo

```bash
# Run via make
make demo:verify

# Or run directly via script
npx tsx scripts/demo-run.ts

# Or run via CLI directly
./build/Release/requiem doctor
./build/Release/requiem policy check --request examples/demo/input.json
./build/Release/requiem plan hash --plan examples/demo/plan.json
./build/Release/requiem plan run --plan examples/demo/plan.json --workspace .
./build/Release/requiem log verify
```

## Expected Outputs

### Policy Check
- Exit code: 0
- Output: `{"ok":true,"allowed":true,...}`

### Plan Hash
- Deterministic hash (same on every run)
- Output: JSON with `plan_hash` field

### Plan Run
- Receipt hash produced
- Output: JSON with `receipt_hash`, `run_id`, `steps_completed`

### Log Verify
- Exit code: 0
- Output: `{"ok":true,"entries_checked":N,"breaks":[]}`

## Replay Verification

After running the plan, you can verify replay exactness:

```bash
# The receipt hash from plan run
RECEIPT_HASH=$(./build/Release/requiem plan run --plan examples/demo/plan.json --workspace . | jq -r '.receipt_hash')

# Verify replay (conceptual - actual replay uses receipt)
echo "Receipt hash: $RECEIPT_HASH"
echo "Re-running should produce identical receipt (determinism guarantee)"
```

## Artifacts

Demo artifacts are written to `demo_artifacts/`:
- `demo-summary.json` — Run summary with hashes
- `demo-receipt.json` — Execution receipt
- `demo-log.ndjson` — Event log entries from demo

These are gitignored and cleaned by `make demo:clean`.
