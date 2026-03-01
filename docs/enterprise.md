# Enterprise — Provable AI Runtime

Requiem Enterprise adds enforced governance, multi-tenant isolation, and compliance controls
on top of the open-source deterministic execution engine.

## Three Guarantees (All Tiers)

Every tier — OSS, Pro, Enterprise — enforces the same core guarantees:

1. **Provable Execution** — Identical inputs produce identical `result_digest` values. BLAKE3 domain-separated hashing, canonical JSON serialization, 200x repeat verification in CI.
2. **Enforced Governance** — Deny-by-default policy gate on every tool invocation. RBAC, budgets, guardrails, and audit logging enforced before execution.
3. **Replayable Outcomes** — Content-addressable storage with dual-hash verification. Any execution replayable and verifiable against its original proof.

## Tiers

| | OSS | Pro | Enterprise |
|---|---|---|---|
| Deterministic execution | Yes | Yes | Yes |
| CAS (dual-hash verification) | Yes | Yes | Yes |
| Policy gate (deny-by-default) | Yes | Yes | Yes |
| Replay verification | Yes | Yes | Yes |
| CLI + Dashboard | Yes | Yes | Yes |
| Execution credits / month | 1,000 | 50,000 | Unlimited |
| Replay storage | 1 GB | 50 GB | Unlimited |
| Policy events tracked | 10,000 | 500,000 | Unlimited |
| Multi-tenant isolation | — | Yes | Yes |
| SOC 2 compliance controls | — | — | Yes |
| Signed artifact chain | — | — | Yes |
| Cluster coordination | — | — | Yes |
| Drift detection | — | — | Yes |
| SLA-backed support | — | — | Yes |

## Architecture Boundary

Enterprise code lives behind explicit feature gates:

- **Runtime**: Checked via `REQUIEM_ENTERPRISE=true` environment variable
- **Build-time**: Enterprise modules are in separate packages/directories
- **Import boundary**: Verified by `scripts/verify-boundaries.sh` in CI

The OSS build never imports enterprise-only modules. This is enforced by CI.

## Deployment Options

| Mode | Description |
|------|-------------|
| Cloud-managed | Hosted at readylayer.com |
| On-premises | Self-hosted with license key |
| Hybrid | Cloud control plane, on-prem execution |

## Usage Metering

Three primitives:

- **Execution credits**: Each tool invocation through the policy gate consumes one credit.
- **Replay storage**: Immutable execution records stored for replay verification.
- **Policy events**: Every policy gate evaluation is tracked and auditable.

## Contact

For enterprise inquiries: sales@readylayer.com
