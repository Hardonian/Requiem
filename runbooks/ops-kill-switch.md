# Runbook: Emergency Kill Switch Activation

**Severity:** P1
**Trigger:** Replay mismatch, CAS corruption, or platform-wide safety concern
**Requires:** `admin` RBAC role + incident ticket

## Kill Switches Available

| Switch | Effect | Location |
|--------|--------|----------|
| `kill_switch_protocol_writer` | Disables new protocol frame writes; replay/reads still work | `policy/default.policy.json` |
| `kill_switch_cas_writer` | Disables new CAS write operations; reads/verification still work | `policy/default.policy.json` |

## Activation Procedure

1. **Open incident ticket** (required — policy enforces this).

2. **Edit policy file:**
   ```bash
   # In policy/default.policy.json:
   # "kill_switch_protocol_writer": true   # OR
   # "kill_switch_cas_writer": true
   ```

3. **Verify policy is valid:**
   ```bash
   ./scripts/verify_policy.sh
   ```

4. **Restart all engine nodes** (policy is loaded at startup):
   ```bash
   # Send SIGHUP or restart service
   systemctl restart requiem-engine
   ```

5. **Verify kill switch is active:**
   ```bash
   curl -H "Authorization: Bearer $ADMIN_TOKEN" /api/engine/status \
     | jq '.policy.feature_flags'
   ```

6. **Log activation in audit:**
   Kill switch activation is automatically logged to the immutable audit log.
   Verify: `curl /api/audit/logs | grep kill_switch`

## Deactivation Procedure

1. Confirm incident is resolved (root cause fixed, tests green).
2. Set kill switch back to `false` in `policy/default.policy.json`.
3. Run `./scripts/verify_policy.sh`.
4. Restart engine nodes.
5. Run full verification: `./scripts/verify.sh`.
6. Close incident ticket and update runbook with root cause.

## Invariants During Kill Switch

- **Protocol writer off:** Existing executions continue; no new NDJSON frames written.
  Audit log still functions. Replay verification still works.
- **CAS writer off:** Existing CAS objects still readable and verifiable.
  New executions will fail with `cas_write_disabled` error (structured, not 500).
- **Never** silently drop requests — always return structured error body.
