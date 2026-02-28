# Parallel Audit Summary — Requiem AI Architecture Upgrade

Auditor: Gemini 3 Flash (Parallel Support)
Focus: Audit, Stress, Red-Team, Evaluation Expansion

## Executive Summary

The Requiem AI Architecture upgrade is structurally sound in its intent (Antigravity aligned) but currently exhibits "Protocol Blind Spots" where tool definitions and tenant isolation boundaries are implicit rather than enforced. This audit identified 5 critical risk areas and provided 20+ adversarial test cases to harden the system.

## Top 10 Architectural Strengths

1.  **Strict Determinism Foundation**: C++ core invariants are well-protected and auditable.
2.  **Explicit Domain Separation**: Use of BLAKE3 with `req:`, `res:`, and `cas:` prefixes ensures cryptographic isolation.
3.  **Junction-Based Triggering**: Decouples event detection from agent execution.
4.  **Fallback Resilience**: Automatic fallback to `minimax_regret` when models fail is implemented in the adapter.
5.  **Schema-First Tool Planning**: MCP tool contracts are explicitly defined (though implementation is pending).
6.  **Traceability**: Every decision result includes a `decision_trace` for audit.
7.  **Multi-Worker Safety**: `Turbo` vs. `Repro` modes allow for parallel development without sacrificing verification.
8.  **Workspace Confinement**: Sandboxing (Named Jobs on Win, Process Groups on POSIX) prevents escape.
9.  **Budget Infrastructure**: Placeholders for `max_concurrent` and `max_output_bytes` are present.
10. **Clean CLI/Engine Separation**: Orchestration remains in TS while heavy lifting is in C++.

## Top 10 Risk Areas

1.  **Implicit Multi-Tenancy**: Commands like `decide_explain` lack explicit tenant ownership verification (TR-01).
2.  **Tool Metadata Gaps**: No `isDeterministic` or `idempotent` flags in tool contracts (TR-02, TR-03).
3.  **Recursion Explosions**: Potential for infinite agent loops without depth-hardened circuit breakers (POL-ADV-003).
4.  **Token Velocity Spikes**: Missing per-tenant real-time velocity detection (COST-01).
5.  **Payload Bombs**: Unbounded `trigger_data` parsing leading to potential OOM attacks (SEC-02).
6.  **Silent Tool Drift**: Risk of non-reproducible tool results if tool logic changes without versioning.
7.  **Stack Trace Leaks**: Potential for internal error exposure through the MCP JSON-RPC layer.
8.  **Replay Duplication**: Retried tool calls generating duplicate side effects in database.
9.  **Credential Proximity**: High risk of agents accessing `process.env` secrets if not strictly filtered.
10. **Evaluation Latency**: Current evaluation datasets are manual/limited; risk of untested model regressions.

## Recommended High-Leverage Improvements

*   **Mandatory Context Injection**: Modify `ToolHandler` to receive a validated `SkillContext` including `tenantId`.
*   **Circuit Breaker Integration**: Implement the `COST_ANOMALY_STRATEGY` at the orchestrator entry point.
*   **Trace Normalization**: Adopt `TRACE_ANALYTICS` rules to ensure cross-model observability.
*   **Automated Adversarial Eval**: Integrate `policy_adversarial_cases.json` into the CI pipeline (`verify:agent-quality`).
*   **Tool Versioning**: Add `version` and `digest` to `ToolDefinition` to ensure replayer consistency.

## Evaluation Coverage Gaps

*   **Negatives/Adversarials**: 0 entries in current `goldens` for failed/blocked attempts.
*   **Performance Stability**: No current benchmarks for "Reasoning Overhead (RO)".
*   **Long-Tail Reasoning**: Missing complex multi-step dependency cases in `skill_regression_cases.json`.

---
**Status**: AUDIT COMPLETE - Documentation and Test Suites generated.
