> **Status: historical / non-canonical for first-customer deployment.** Current deployment truth is documented in [`README.md`](../README.md), [`DEPLOYMENT.md`](./DEPLOYMENT.md), and [`OPERATOR_RUNBOOK.md`](./OPERATOR_RUNBOOK.md). Treat this document as background material unless and until the code/tests re-establish the claims below.

# Enterprise — Control Plane for AI Systems

Requiem Enterprise adds enforced governance, multi-tenant isolation, and compliance controls on top of the open-source deterministic execution engine.

## Not a Wrapper. Not a Router. A Control Plane

This is infrastructure for operators who need provable AI systems. Not a toy. Not a convenience layer. Governance is foundational.

## Category Definition

### What a Control Plane Is

A control plane enforces invariants that other systems leave to chance:

- **Deterministic replay semantics** — identical inputs produce identical outputs across runs, workers, and time
- **Policy enforcement boundaries** — deny-by-default on every tool invocation
- **Provenance fingerprinting** — every execution produces a cryptographic proof
- **Economic compute units** — explicit metering, not hidden costs
- **Observability spine** — complete trace from request to proof

### Why Determinism Matters

Non-deterministic AI execution is the root cause of:

- "It worked yesterday" bugs
- Audit gaps
- Failed compliance reviews
- Unreproducible regulatory evidence

### Why Governance is Foundational

Policy is not an afterthought. In Requiem:

- Every execution passes through the policy gate
- No bypasses are possible
- Policy violations are caught before they complete
- Evidence is generated during execution, not retroactively

## Three Guarantees (All Tiers)

Every tier — OSS, Pro, Enterprise — enforces the same core guarantees:

1. **Provable Execution** — Identical inputs produce identical `result_digest` values. BLAKE3 domain-separated hashing, canonical JSON serialization, 200× repeat verification in CI.
2. **Enforced Governance** — Deny-by-default policy gate on every tool invocation. RBAC, budgets, guardrails, and audit logging enforced before execution.
3. **Replayable Outcomes** — Content-addressable storage with dual-hash verification. Any execution replayable and verifiable against its original proof.

## Feature Layer Mapping

All features map to one of these layers:

| Layer                                         | OSS   | Pro  | Enterprise        |
| :-------------------------------------------- | :---- | :--- | :---------------- |
| **Control** (Determinism, Replay, Provenance) | ✅    | ✅   | ✅                |
| **Governance** (Policy Gate, RBAC, Budgets)   | ✅    | ✅   | ✅                |
| **Economic** (Metering, Quotas, Chargeback)   | —     | ✅   | ✅                |
| **Observability** (Traces, Metrics, Audit)    | Basic | Full | Full + Compliance |
| **Enterprise Extensions**                     | —     | —    | ✅                |

### Control Layer

| Feature                      | OSS | Pro | Enterprise |
| :--------------------------- | :-- | :-- | :--------- |
| Deterministic execution      | ✅  | ✅  | ✅         |
| CAS (dual-hash verification) | ✅  | ✅  | ✅         |
| Replay verification          | ✅  | ✅  | ✅         |
| 200× repeat gate in CI       | ✅  | ✅  | ✅         |

### Governance Layer

| Feature                       | OSS | Pro | Enterprise |
| :---------------------------- | :-- | :-- | :--------- |
| Policy gate (deny-by-default) | ✅  | ✅  | ✅         |
| RBAC capabilities             | ✅  | ✅  | ✅         |
| Budget enforcement            | ✅  | ✅  | ✅         |
| Content guardrails            | ✅  | ✅  | ✅         |
| Audit logging                 | ✅  | ✅  | ✅         |

### Economic Layer

| Feature                         | OSS       | Pro        | Enterprise |
| :------------------------------ | :-------- | :--------- | :--------- |
| Execution credits               | 1,000/mo  | 50,000/mo  | Unlimited  |
| Replay storage                  | 1 GB      | 50 GB      | Unlimited  |
| Policy events                   | 10,000/mo | 500,000/mo | Unlimited  |
| Cost accounting                 | —         | ✅         | ✅         |
| Billing/Cost allocation reports | —         | ✅         | ✅         |

### Observability Layer

| Feature                       | OSS | Pro | Enterprise |
| :---------------------------- | :-- | :-- | :--------- |
| CLI + Dashboard               | ✅  | ✅  | ✅         |
| Execution traces              | ✅  | ✅  | ✅         |
| Determinism metrics           | ✅  | ✅  | ✅         |
| Adversarial safety monitoring | —   | ✅  | ✅         |
| Merkle chain audit log        | —   | ✅  | ✅         |
| SOC 2 compliance export       | —   | —   | ✅         |

### Enterprise Extensions

| Feature                | OSS | Pro | Enterprise |
| :--------------------- | :-- | :-- | :--------- |
| Multi-tenant isolation | —   | ✅  | ✅         |
| Signed artifact chain  | —   | —   | ✅         |
| Cluster coordination   | —   | —   | ✅         |
| Drift detection        | —   | —   | ✅         |
| SLA-backed support     | —   | —   | ✅         |

## Architecture Boundary

Enterprise code lives behind explicit feature gates:

- **Runtime**: Checked via `REQUIEM_ENTERPRISE=true` environment variable
- **Build-time**: Enterprise modules are in separate packages/directories
- **Import boundary**: Verified by `scripts/verify-boundaries.sh` in CI

The OSS build never imports enterprise-only modules. This is enforced by CI.

## Deployment Options

| Mode          | Description                            |
| :------------ | :------------------------------------- |
| Cloud-managed | Hosted at readylayer.com               |
| On-premises   | Self-hosted with license key           |
| Hybrid        | Cloud control plane, on-prem execution |

## Usage Metering

Three primitives:

- **Execution credits**: Each tool invocation through the policy gate consumes one credit.
- **Replay storage**: Immutable execution records stored for replay verification.
- **Policy events**: Every policy gate evaluation is tracked and auditable.

## Contact

For enterprise inquiries: <sales@readylayer.com>
