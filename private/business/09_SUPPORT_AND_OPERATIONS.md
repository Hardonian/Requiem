# Support & Operations: Requiem

## 1. Support Tiers
- **Community (OSS)**: GitHub Issues & Discord (Best effort).
- **Pro**: Email support (24-hour turnaround).
- **Enterprise**: Priority Ticket System + Slack Connect (4-hour response for Critical issues).

## 2. Triage Workflow
1. **Report**: Incident/bug reported via `reach doctor` or dashboard.
2. **Reproduce**: Customer provides a `result_digest` or CAS volume.
3. **Verify**: Requiem team replays the run in a debug sandbox using the provided hashes.
4. **Remediate**: Fix applied to Policy or Engine.

## 3. Incident Response Outline
- **SEV 1 (Policy Bypass)**: Immediate response within 30 minutes. Full audit of all impacted runs in the ledger.
- **SEV 2 (CAS Corruption)**: Response within 2 hours. Restore from Merkle-backups.
- **SEV 3 (Dashboard Lag)**: Response within 4 hours. Scale ReadyLayer UI instances.

## 4. Operational Runbooks (High-Level)
- **Engine Recovery**: Steps to restart the native engine if a sandbox violation occurs.
- **Ledger Rotation**: Policy for rotating Merkle roots for long-running systems.
- **Credential Rotation**: Safe procedures for updating model provider keys (e.g., OpenAI API Keys).

## 5. System Health Metrics
- **Verification Latency**: Time to compute BLAKE3 proof.
- **Policy Gate Hit Rate**: Tracking of allowed vs denied executions.
- **CAS Health**: Disk space and hash integrity checks.
