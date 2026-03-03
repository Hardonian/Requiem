# Requiem Demo

> **60-second demo** — Run the complete vertical slice in one command.

## Quick Start

```bash
# Build the engine (one-time)
make build

# Run the demo
make demo

# Or run with verification
make demo:verify
```

## What the Demo Does

The demo executes a full vertical slice:

```
doctor → policy check → plan hash → plan run → receipt → log verify
```

1. **Doctor Check** — Validates environment and engine health
2. **Policy Check** — Verifies request against policy rules
3. **Plan Hash** — Computes deterministic plan content hash
4. **Plan Run** — Executes plan with receipt generation
5. **Receipt** — Captures execution proof
6. **Log Verify** — Validates event log chain integrity

## Expected Output

```
╔════════════════════════════════════════════════════════════════╗
║  REQUIEM DEMO RUN                                              ║
╚════════════════════════════════════════════════════════════════╝

Trace ID:      demo-abc123def456
Run ID:        run-1234567890123-abc
Receipt Hash:  abc123... (64 hex chars)
Log Verify:    ✓ PASS
Duration:      150ms

Steps:
✓ PASS doctor              25ms
✓ PASS policy_check        10ms
✓ PASS plan_hash           15ms
✓ PASS plan_run            80ms
✓ PASS log_verify          20ms

╔════════════════════════════════════════════════════════════════╗
║  DEMO PASSED ✓                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

## Verifying Replay Exactness

Determinism guarantee: Re-running produces identical results.

```bash
# First run
./build/Release/requiem plan run --plan examples/demo/plan.json --workspace .
# Note the receipt_hash

# Second run (should produce same receipt_hash)
./build/Release/requiem plan run --plan examples/demo/plan.json --workspace .
# receipt_hash should match
```

The demo automatically verifies this via `make demo:verify`.

## Demo Artifacts

Artifacts are written to `demo_artifacts/`:

| File | Contents |
|------|----------|
| `demo-summary.json` | Full run summary with all step results |
| `demo-receipt.json` | Receipt hash and run metadata |

These files are gitignored and cleaned with `make demo:clean`.

## Finding Receipts and Logs

### Receipts
Receipts are stored in the CAS (Content-Addressable Storage):

```bash
# List receipts
./build/Release/requiem cas ls --prefix rcpt:

# Show specific receipt
./build/Release/requiem receipt show --hash <receipt_hash>

# Verify receipt
./build/Release/requiem receipt verify --hash <receipt_hash>
```

### Event Logs
Event logs are stored in `.requiem/event_log.ndjson`:

```bash
# View recent events
./build/Release/requiem log tail --lines 20

# Verify chain integrity
./build/Release/requiem log verify

# Search events
./build/Release/requiem log search --query "plan.run"
```

## Common Failures and Fixes

### "Doctor failed with exit code 2"

**Cause:** Engine health check found blockers.

**Fix:** Run doctor for details:
```bash
./build/Release/requiem doctor --json
```

Common blockers:
- Engine not built: Run `make build`
- Wrong hash backend: Check OpenSSL installation

### "Policy check failed"

**Cause:** Policy rejected the demo request.

**Fix:** Check policy file is valid:
```bash
./build/Release/requiem lint examples/demo/policy.json
```

### "Plan run failed"

**Cause:** Execution error or timeout.

**Fix:** Check plan JSON syntax:
```bash
# Validate plan
./build/Release/requiem plan verify --plan examples/demo/plan.json
```

### "Log verify failed"

**Cause:** Event log chain broken or corrupted.

**Fix:** Check log file exists and is readable:
```bash
ls -la .requiem/event_log.ndjson
```

If corrupted, you may need to reset (WARNING: loses history):
```bash
mv .requiem/event_log.ndjson .requiem/event_log.ndjson.bak
```

### "Replay mismatch"

**Cause:** Non-deterministic behavior detected.

**Possible causes:**
- Environment variables not in allowlist
- Random seed not fixed
- Time-dependent operations

**Fix:** Check for environment contamination:
```bash
# See full environment
env | grep -v ^_ | sort
```

## Demo Fixtures

The demo uses deterministic fixtures in `examples/demo/`:

| Fixture | Purpose |
|---------|---------|
| `policy.json` | Policy rules for demo execution |
| `plan.json` | Two-step execution plan |
| `input.json` | Sample request context |

All fixtures are designed for determinism:
- Fixed timestamps (no wall-clock dependencies)
- Minimal environment (empty `env_allowlist`)
- Stable ordering (fixed array elements)

## Manual Demo Steps

If you prefer to run steps manually:

```bash
# 1. Doctor
./build/Release/requiem doctor

# 2. Policy check
./build/Release/requiem policy check --request examples/demo/input.json

# 3. Plan hash
./build/Release/requiem plan hash --plan examples/demo/plan.json

# 4. Plan run
./build/Release/requiem plan run --plan examples/demo/plan.json --workspace .

# 5. Log verify
./build/Release/requiem log verify

# 6. CAS verify
./build/Release/requiem cas verify
```

## Web UI Demo

If the web console is running:

```bash
# Start web console
pnpm run web:dev

# Then visit:
# http://localhost:3000/console
```

The web console provides:
- Visual plan execution
- Receipt browser
- Event log viewer
- Policy editor

## CI Demo Job

The demo runs in CI to verify deterministic behavior:

```yaml
# .github/workflows/demo.yml
demo:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Build
      run: make build
    - name: Demo
      run: make demo:verify
      timeout-minutes: 2
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Demo passed |
| `1` | General error |
| `2` | Doctor blockers found |

## Related Documentation

- [CLI Contract](contracts/cli_contract.md) — Command specifications
- [API Envelope Contract](contracts/api_envelope_contract.md) — Response format
- [VERTICAL_SLICE.md](VERTICAL_SLICE.md) — Kernel walkthrough
- [CONTRACT.md](CONTRACT.md) — API specifications
