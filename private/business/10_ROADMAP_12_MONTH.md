# 12-Month Product Roadmap: Requiem

**Version**: 1.0.0  
**Last Updated**: 2026-03-02

## Q1: Foundation & Provability (Current)
- [x] Native C++ Engine with BLAKE3.
- [x] `reach` CLI with `run` and `verify`.
- [x] Initial Policy VM (RBAC & Budgets).
- [x] CAS v2 (Dual-hash storage).
- [ ] **Milestone**: Beta launch of ReadyLayer Cloud for early adopters.

## Q2: Governance & Scale
- [ ] **Multi-Model Consensus**: Run same prompt through 3 models, only execute if 2/3 agree (deterministic voting).
- [ ] **Advanced Policy VM**: Support for external data lookups in policy rules (e.g., check SQL database before allow).
- [ ] **Global CAS Replication**: Near-real-time sync of execution receipts across regions.
- [ ] **Milestone**: Public OSS Launch (Product Hunt).

## Q3: Enterprise & Compliance
- [ ] **SOC 2 Type II Prep**: Automated evidentiary logging for all AI transitions.
- [ ] **Zero-Knowledge Proofs (ZKP)**: Prove an agent followed policy without revealing the sensitive prompt or data.
- [ ] **SSO & Advanced RBAC**: Integration with Okta/Azure AD for ReadyLayer.
- [ ] **Milestone**: General Availability (GA) for Enterprise Tier.

## Q4: Ecosystem & Intelligence
- [ ] **The Proof Marketplace**: Shareable, signed "Safety Profiles" for popular LLMs.
- [ ] **Self-Healing Agents**: Automated "drift-correction" where the system re-runs failed verify steps in a clean sandbox.
- [ ] **Mobile Control Plane**: ReadyLayer app for on-the-go policy overrides and budget alerts.
- [ ] **Milestone**: First 100 Enterprise Customers.

---

*Note: This roadmap is subject to change based on the "Entropy Reduction" principle. Security and determinism take priority over feature velocity.*
