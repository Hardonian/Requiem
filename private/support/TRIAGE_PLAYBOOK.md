# Triage Playbook: Requiem Support

## SLA Targets (Internal)

| Severity | Description | Core Goal | Initial Response |
|----------|-------------|-----------|------------------|
| **P0 (Critical)** | Determinism break, tenant leakage, or production outage. | Resolve in < 4h | 30 mins |
| **P1 (High)** | Major feature failure, regression in Microfracture Suite. | Resolve in < 24h | 2h |
| **P2 (Normal)** | Performance drift, documentation error, minor UI bug. | Resolve in < 1 week | 8h |
| **P3 (Low)** | Aspirational feature request, cosmetic issue. | Best effort | 24h |

## Triage Workflow

1. **Verify Identity**: Check the `Execution Fingerprint` provided by the user.
2. **Reproduce via Replay**:
   - Use `pnpm reach replay <artifact_id>` to attempt byte-for-byte reproduction.
   - If reproduction fails to diverge local state from the user's reported state, it is likely an environment issue (Sanitize check).
3. **Check Invariants**:
   - Run `pnpm reach chaos --strict` on the reported build.
   - Check `verify:tenant-isolation` if privacy concerns are raised.
4. **Route Component**:
   - **Native Engine**: Escalate to Core/C++ leads.
   - **Control Plane**: Escalate to TypeScript/Arch leads.
   - **ReadyLayer UI**: Route to Frontend/Fusion.

## Routing Shortcuts
- Tag Issue with `type:invariant-break` for p0 priority.
- Tag Issue with `type:determinism-drift` for p1 priority.
