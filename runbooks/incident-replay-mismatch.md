# Runbook: Replay Mismatch Incident

**Severity:** P1
**Trigger:** `replay_digest != result_digest` for any execution
**Auto-capture:** Yes (see policy/default.policy.json `auto_capture_on_replay_mismatch`)

## What This Means

A replay mismatch indicates that re-executing a stored input produced a different
`result_digest` than the original execution. This violates the core determinism
invariant (INV-1) and requires immediate investigation.

**Possible causes:**
1. Non-deterministic code path introduced (wall-clock time, randomness, env leak)
2. Hash algorithm version mismatch between original and replay node
3. CAS object corruption (CAS-INV-2 violation)
4. Protocol framing version mismatch
5. Dependency upgrade changed behavior

## Immediate Actions (< 5 minutes)

1. **Capture incident bundle:**
   ```bash
   reach bugreport --bundle --incident <ticket_id>
   ```

2. **Identify the affected execution:**
   ```bash
   # Check audit log for execution with replay_verified=false
   cat $REQUIEM_AUDIT_LOG | grep '"replay_verified":false' | tail -5
   ```

3. **Freeze replay writer (prevent more divergent replays):**
   ```bash
   # Activate kill switch in policy (emergency only)
   # Edit policy/default.policy.json:
   # "kill_switch_protocol_writer": true
   # Then restart the engine.
   ```

4. **Notify on-call:** P1 escalation, attach bundle.

## Investigation (< 30 minutes)

1. **Check version consistency:**
   ```bash
   ./scripts/verify_version_contracts.sh
   ./scripts/verify_compat_matrix.sh
   ```

2. **Check cluster drift:**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" /api/cluster/drift
   ```

3. **Run determinism verification:**
   ```bash
   ./scripts/verify_determinism.sh
   ```

4. **Check for environment leakage:**
   ```bash
   # Compare environment at original execution vs replay
   diff <(cat original_env.json) <(cat replay_env.json)
   ```

5. **Inspect the diverging execution:**
   ```bash
   # Get execution bundle
   curl -H "Authorization: Bearer $TOKEN" /api/executions/{id}/bundle
   ```

## Root Cause Identification

| Symptom | Likely Cause | Resolution |
|---------|-------------|------------|
| Only affects one node | Node-specific env leak | Rebuild node, check env allowlist |
| Affects all nodes | Code path non-determinism | Revert last code change, run golden corpus |
| Affects one tenant | Tenant-specific input | Validate input canonicalization |
| After version bump | Hash/protocol regression | Roll back version, add regression test |
| Intermittent | Race condition | Run TSAN, check for data races |

## Recovery

1. **If env leak:** Patch the env canonicalization allowlist. Deploy. Re-run.
2. **If code regression:** Revert. File bug. Add regression test.
3. **If CAS corruption:** See `incident-cas-corruption.md`.
4. **If version mismatch:** See `incident-cluster-incompatibility.md`.

## Post-Incident

1. Add golden corpus fixture for the diverging input.
2. Update `contracts/determinism.contract.json` with the discovered non-determinism source.
3. Add test in `tests/requiem_tests.cpp` that prevents regression.
4. File PR with: `Determinism-Regression: fixed <root_cause>`
5. Disable kill switch once confirmed fixed.

## Escalation

- **Not resolved in 2 hours:** Page engineering lead.
- **CAS corruption confirmed:** Immediately escalate to data integrity protocol.
- **All executions failing:** Activate full maintenance mode.
