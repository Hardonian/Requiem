# Requiem Runbooks

Operational runbooks for incident response, recovery, and platform operations.

## Incident Response Index

| Runbook | Trigger | Severity |
|---------|---------|----------|
| [incident-replay-mismatch.md](incident-replay-mismatch.md) | replay_digest != result_digest | P1 |
| [incident-cas-corruption.md](incident-cas-corruption.md) | CAS integrity check failure | P1 |
| [incident-cluster-incompatibility.md](incident-cluster-incompatibility.md) | Version mismatch in cluster | P2 |
| [incident-p99-spike.md](incident-p99-spike.md) | p99 latency > threshold | P2 |
| [ops-kill-switch.md](ops-kill-switch.md) | Emergency protocol/CAS kill switch | P1 |
| [ops-tenant-export.md](ops-tenant-export.md) | Tenant data export request | P3 |
| [ops-version-bump.md](ops-version-bump.md) | Protocol/CAS version bump procedure | P3 |

## Invariants That Must Not Break

See `INVARIANTS.md` at repo root. During any incident:
- **Never** accept a CAS write whose digest does not match the computed BLAKE3.
- **Never** suppress a structured error — always emit a JSON error body.
- **Never** let determinism drift silently — log and alert on first divergence.
- **Never** skip the compat matrix check when forming a cluster.

## Incident Bundle

Every P1 incident must include a captured bundle:
```
reach bugreport --bundle --incident <ticket_id>
```
Bundle contents: replay inputs, recent metrics window, engine self-audit,
prompt/dependency snapshot, schema snapshot.

Bundles stored in: `artifacts/incidents/`
