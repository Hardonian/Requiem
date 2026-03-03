# Enterprise Risk Register: Requiem

**Version**: 1.0.0  
**Last Updated**: 2026-03-02

## 1. Technical Risks

| ID | Risk | Impact | Likelihood | Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| **TR-01** | Model Drift | High | High | Semantic drift detection in `reach drift`. Automated alerts when fingerprints deviate beyond thresholds. |
| **TR-02** | Sandbox Escape | Critical | Low | Native engine uses restricted process namespaces. Multi-layered capability enforcement (RBAC). |
| **TR-03** | CAS Hash Collision | Low | Very Low | Dual-hashing strategy (BLAKE3 + SHA-256). |
| **TR-04** | Latency Overhead | Medium | Medium | C++ core implementation. Hashing parallelization. |

## 2. Business & Operational Risks

| ID | Risk | Impact | Likelihood | Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| **OR-01** | Vendor Lock-in | Medium | Low | MIT licensed core engine. Open data formats (JSON, standard Merkle chains). |
| **OR-02** | Cost Explosion | High | Medium | Policy VM enforces hard budgets per tenant/request. Native metering. |
| **OR-03** | Compliance Lags | Medium | Medium | "Designed for Compliance" architecture. Early focus on SOC 2 audit trails. |

## 3. Security Risks (AI-Specific)

| ID | Risk | Impact | Likelihood | Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| **SR-01** | Prompt Injection | High | High | Policy VM blocks tool calls *regardless* of model intent. Deny-by-default logic ensures safe boundaries. |
| **SR-02** | Data Leakage | Critical | Medium | Tenant isolation verification commands (`reach tenant-check`). Domain-separated storage. |

## 4. Risk Mitigation Strategy: "The Green Objective"

We maintain a "Green" status across all core tests (determinism, isolation, policy). Any regression in these core invariants triggers an immediate "Stop-Work" on new features until the risk is neutralized.

## 5. Contingency Plans

- **Audit Failure**: If a receipt fails verification, the system automatically tags all subsequent runs as "UNVERIFIED" until a manual audit clears the cache.
- **Provider Outage**: Multi-model support allows switching providers while maintaining the same Policy VM governance.
