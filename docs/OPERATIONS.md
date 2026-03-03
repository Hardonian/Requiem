# Operations & Observability

> **Audience:** Operators, SREs.  
> **Mission:** Keep the chain of truth intact.

Requiem is designed for high-integrity operations. This guide covers how to monitor, troubleshoot, and maintain the system.

---

## 1. Traceability & Logging

Every execution in Requiem is assigned a unique `trace_id` and `correlation_id`. These IDs flow through all layers — from the Next.js API down to the C++ kernel.

### Structured Logs
All logs are emitted as NDJSON.
- **`tenant_id`**: Identifies the customer/tenant.
- **`run_id`**: Identifies a specific agent run.
- **`trace_id`**: Spans multiple related operations.

### Searching Logs
```bash
# Find all errors for a specific trace
grep "trace-uuid-123" logs/app.log | grep '"level":"error"'
```

---

## 2. The "Suite Doctor"

The `pnpm doctor` command is your first line of defense for troubleshooting. It checks:
- Native binary availability and versions.
- Workspace write permissions.
- Environment variable completeness.
- CAS mount points and disk space.

```bash
pnpm doctor
```

For automated monitoring, use the JSON output:
```bash
pnpm doctor -- --json
```

---

## 3. Monitoring Core Metrics

| Metric | Source | Critical Threshold |
| :--- | :--- | :--- |
| **Determinism Failure** | `scripts/verify_drift.sh` | > 0 |
| **CAS Integrity Error** | Engine Logs | > 0 |
| **Policy Violation Rate** | AI Gate Logs | > 5% (Potential attack) |
| **Budget Exhaustion** | AI Policy Logs | > 10% (Quota tuning needed) |

---

## 4. Troubleshooting Common Issues

### "E_INT_DETERMINISM_VIOLATION"
**Cause:** The same plan produced a different receipt hash. This usually happens if the tool logic uses unseeded random numbers or wall-clock time.
**Fix:** Ensure all non-determinism is moved to input parameters or seeded via the `plan` context.

### "E_CAS_INTEGRITY_FAILED"
**Cause:** The object on disk does not match its hash. This indicates bit-rot or manual tampering.
**Fix:** Delete the offending object from `.cas/v2/objects/[hash]` and let the system re-generate or re-fetch it.

### "E_POL_VIOLATION"
**Cause:** An agent tried to access a tool it isn't authorized for, or hit a guardrail.
**Fix:** Check `tenant_id` capabilities in the Tool Registry.

---

## 5. Maintenance Tasks

### Backing up the CAS
Since objects are immutable and content-addressed, you can safely `rsync` the `.cas/` directory to a cold storage bucket (S3/GCS) without locking.

### Compacting the Event Log
The event log is append-only. Periodically rotate the NDJSON files. The `pnpm req log verify` command can walk across rotated files if they are named sequentially.

---

## References
- [ARCHITECTURE.md](./ARCHITECTURE.md) — For system component map.
- [errors.md](./errors.md) — For a full list of error codes and remediation.
