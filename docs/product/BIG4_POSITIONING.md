# BIG4 Positioning

## What it is

BIG4 is Requiem's operational trust layer:
1. Deterministic replay and black-box auditability
2. Verified sandbox runtime registry
3. Spend firewall and economic guardrails
4. Drift radar and stability tracking

## Who it is for

- Platform teams running multi-tenant AI workloads
- Security and governance teams requiring tenant-scoped audit trails
- Reliability/ML Ops teams enforcing deterministic behavior over time

## What is shipped in this pass

A production-grade shared primitive layer (canonicalization, envelopes, append-only audit, request safety middleware, feature flagging) that all four offerings build on directly.
