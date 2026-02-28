# AI Architecture — Requiem System

This document provides a technical overview of the AI integration layer for the Requiem execution engine.

## 1. Core Architecture

The AI layer sits atop the deterministic Requiem core, providing agentic reasoning while maintaining strict auditability.

*   **Model Registry**: Centralized management of LLM providers and configuration.
*   **Policy Gate**: Stateless enforcement of security and budget constraints.
*   **Skill Runner**: Orchestration layer for executing composable agent capabilities.
*   **Arbitration**: Logic for selecting the optimal model based on cost and capability.
*   **Memory Bridge**: Deterministic context management for long-running agents.

## 2. Components

### Tool Registry
Standardized interface for exposing system capabilities to AI agents.
*   **Schema**: JSON Schema validation for all inputs.
*   **Audit**: Every tool call is hashed and recorded in the trace.

### Policy Gate
The security boundary between untrusted agent reasoning and trusted system tools. All tool invocations MUST pass through the policy gate.

| Layer | Enforcement | Goal |
| --- | --- | --- |
| Tenant Scoping | Tool calls are checked to ensure they operate within the correct tenant context. | Prevent data leakage between tenants. |
| RBAC | Actor's roles and capabilities are checked against the tool's required capabilities. | Prevent unauthorized actions (least privilege). |
| Side Effects | Tools with side effects (e.g., writing to a database) can be restricted based on actor role. | Prevent viewers or less-privileged roles from modifying state. |
| Budget | Token and recursive depth limits will be enforced to control cost. | Control operational expenditure. |
| Privacy | PII and secret scrubbing will be applied to inputs and outputs. | Ensure data safety and compliance. |

### Skill Runner
Executes "Skills"—high-level abstractions of complex tool chains.
Skills are registered in `packages/cli/src/junctions/` and executed via the `orchestrator.ts`.

## 3. Data Flow (Decision Path)

1.  **Trigger**: External event (e.g., Code Drift) creates a **Junction**.
2.  **Orchestration**: `JunctionOrchestrator` selects appropriate **Skills**.
3.  **Arbitration**: **Arbitrator** assigns an LLM based on task complexity.
4.  **Execution**: **Skill Runner** invokes tools through the **MCP Server**.
5.  **Policy**: **Policy Gate** validates every transition.
6.  **Audit**: Results are stored in **CAS** and recorded in the **Decision Report**.

## 4. Determinism Invariants

AI reasoning is inherently non-deterministic, but the Requiem bridge enforces:
1.  **Stable Inputs**: Prompts are templated and hashed.
2.  **Recorded Traces**: Every step is auditable and replayable.
3.  **Deterministic Tools**: Non-AI components must remain 100% deterministic.

---
**Status**: ARCHITECTURE CLARIFIED - Phase 1/2 Baseline.
