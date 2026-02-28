# Tool Registry Audit — Requiem AI Architecture

This audit evaluates the current (Phase 0/1) state of the Tool Registry, specifically the `ToolDefinition` interface defined in `docs/MCP.md` and its correlation with existing CLI commands in `packages/cli/src/commands/`.

## 1. Interface Audit: `ToolDefinition`

Target: `docs/MCP.md:L71-77`

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  handler: ToolHandler;
}
```

### Findings

#### Missing Required Metadata

*   **Deterministic Flag**: The system (Antigravity mode) prioritizes determinism, but the interface does not allow tools to declare themselves as deterministic (cacheable) vs. non-deterministic (must execute).
*   **Idempotency Indicator**: No way to signal if a tool is safe to retry (idempotent) or has permanent side effects.
*   **Complexity/Cost Hint**: No metadata for budget estimation or task complexity arbitration.

#### Versioning Gaps

*   **Version Field missing**: `ToolDefinition` lacks a version field, making protocol-breaking changes difficult to manage in multi-model environments.

#### Security Observability

*   **Missing Tenant Context**: The handler does not explicitly require a `tenantId` in the interface signature, although `SkillContext` in `docs/SKILLS.md` includes it. The discrepancy between `ToolDefinition` and `SkillContext` creates an integration hazard.

## 2. Risk Matrix (Severity Ranked)

| ID | Risk | Severity | Mitigation |
| --- | --- | --- | --- |
| TR-01 | **Implicit Multi-Tenancy leakage** | CRITICAL | Force `tenantId` into `ToolHandler` context. |
| TR-02 | **Non-deterministic tool results** | HIGH | Add `isDeterministic` flag to `ToolDefinition`. |
| TR-03 | **Side-effect collision** | MEDIUM | Add `idempotent` boolean to tool metadata. |
| TR-04 | **Schema mismatch drift** | MEDIUM | Implement automated schema validation harness. |
| TR-05 | **Missing versioning** | LOW | Add `version: string` to `ToolDefinition`. |

## 3. Implementation Gap Analysis: CLI Commands as Tools

The following CLI commands are planned as MCP tools:
*   `decide_evaluate`
*   `decide_explain`
*   `junctions_list`
*   `junctions_show`

### Audit of `packages/cli/src/commands/decide.ts`

*   **Side Effects**: `handleEvaluate` (Line 100) and `handleOutcome` (Line 218) modify the database (`DecisionRepository.create`, `DecisionRepository.update`).
*   **Determinism**: `handleEvaluate` depends on `evaluateDecision` (Line 131), which has a fallback to `minimax_regret`. This is deterministic but relies on `trigger_data` which is parsed from JSON (Line 121).
*   **Misuse Scenario**: A tool call to `decide_evaluate` without a valid `junctionId` (Line 101) or on a junction belonging to a different tenant (Tenant Isolation check is missing in the command layer).

## 4. Concrete Misuse Scenarios

### Scenario A: Cross-Tenant Probe

An adversary invokes `decide_explain --junction <foreign_id>`.
*   **Current Vulnerability**: `handleExplain` calls `JunctionRepository.findById(args.junctionId)` but does not verify the junction belongs to the current requester's tenant.
*   **Impact**: Information disclosure of system traces and sensitive trigger data.

### Scenario B: Resource Bomb

An adversary calls `decide_evaluate` on a junction with massively bloated `trigger_data`.
*   **Current Vulnerability**: `JSON.parse(junction.trigger_data)` (Line 121) is called without size limits check in the command handler.
*   **Impact**: Node.js memory exhaustion (OOM) in the CLI/MCP process.

### Scenario C: Replay Conflict

A tool call `decide_evaluate` is retried due to a network timeout, but the first call succeeded.
*   **Current Vulnerability**: `DecisionRepository.create` (Line 134) is called twice, creating duplicate decision records for the same junction.
*   **Impact**: Database pollution and invalid decision history.

---
**Status**: DRAFT - Audit generated for Parallel Support.
