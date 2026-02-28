# AI Architecture — Requiem System

_Updated: 2026-02-28 | Source of truth: packages/ai/src/_

This document is the technical overview of the AI control-plane layer (`packages/ai/`).
All claims are backed by file paths and verified by `pnpm run verify:ai`.

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  ready-layer (Next.js)                                          │
│  /api/mcp/health  /api/mcp/tools  /api/mcp/tool/call           │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  MCP Transport (packages/ai/src/mcp/transport-next.ts)          │
│  - Auth + tenant resolution                                     │
│  - JSON envelope wrapping                                       │
│  - Structured error mapping                                     │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  MCP Server (packages/ai/src/mcp/server.ts)                     │
│  handleListTools / handleCallTool / handleHealth               │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Tool Invocation (packages/ai/src/tools/invoke.ts)              │
│  1. Look up tool in registry                                    │
│  2. Policy gate check                                           │
│  3. Input schema validation                                     │
│  4. Handler execution                                           │
│  5. Output schema validation                                    │
│  6. Audit log write                                             │
└──────────────────────┬──────────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
   Policy Gate    Tool Registry    Telemetry
   (gate.ts)      (registry.ts)   (audit.ts, cost.ts, trace.ts)
```

## 2. Components

### Tool Registry (`packages/ai/src/tools/`)
- **registry.ts**: In-memory store keyed by `name@version`
- **invoke.ts**: Single entry point for all tool invocations
- **schema.ts**: JSON Schema structural validation
- **builtins/**: `system.echo@1.0.0`, `system.health@1.0.0`

### Policy Gate (`packages/ai/src/policy/`)
- **gate.ts**: `evaluatePolicy()` — sync, no DB needed
- **capabilities.ts**: Role → capability mapping
- **budgets.ts**: `BudgetChecker` interface (stub by default)

### MCP Server (`packages/ai/src/mcp/`)
- **server.ts**: Framework-agnostic handlers
- **transport-next.ts**: Next.js route adapter
- **types.ts**: Protocol types

### Skills System (`packages/ai/src/skills/`)
- **registry.ts**: In-memory skill store
- **runner.ts**: Step execution (tool/llm/assert) + rollback
- **builtins/**: `skill.trace_summary@1.0.0`, `skill.tool_smoke@1.0.0`

### Model Registry (`packages/ai/src/models/`)
- **registry.ts**: ModelDefinition catalog (Anthropic + OpenAI)
- **arbitrator.ts**: Model selection + fallback logic
- **circuitBreaker.ts**: CLOSED/OPEN/HALF_OPEN state machine
- **providers/**: Anthropic, OpenAI adapters (activated by env var)

### Memory Bridge (`packages/ai/src/memory/`)
- **store.ts**: Canonical content store (file-backed in dev)
- **hashing.ts**: SHA-256 content addressing
- **redaction.ts**: PII/secret redaction before storage
- **vectorPointers.ts**: Optional vector index pointer interface

### Telemetry (`packages/ai/src/telemetry/`)
- **trace.ts**: Span start/end with parent/child relationships
- **cost.ts**: Token + cost accounting (file-backed in dev)
- **audit.ts**: Tool invocation audit log (file-backed in dev)
- **logger.ts**: Structured leveled logger

### Eval Harness (`packages/ai/src/eval/`)
- **harness.ts**: `runEvalHarness()` — runs cases, compares outputs
- **diff.ts**: Structural JSON diff
- **cases.ts**: Case + golden file loader

## 3. Error Envelope

Every API response uses:
```json
{
  "ok": true|false,
  "data": {...},
  "error": {
    "code": "AI_TOOL_NOT_FOUND",
    "message": "...",
    "severity": "warning|error|critical",
    "retryable": false
  },
  "trace_id": "trace_..."
}
```

No stack traces. No internal details. See `packages/ai/src/errors/`.

## 4. Invariants (Enforced)

1. All tool invocations go through `invokeToolWithPolicy()` (not direct handler calls)
2. Tenant context is ALWAYS server-derived, never from request body
3. VIEWER role cannot execute side-effect tools
4. tenantScoped tools require non-empty tenantId
5. Schema validation runs on input AND output
6. Audit log written for every invocation (allow or deny)
7. No raw stack traces in HTTP responses

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
