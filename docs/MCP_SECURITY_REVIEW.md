# MCP Security Review — Requiem Protocol Hardening

Audit of MCP (Model Context Protocol) implementation boundaries and security enforcement.

## 1. Boundary Verification

*   **Schema Enforcement**: REQUIRED. All incoming `params` must be validated against the `inputSchema` defined in `ToolDefinition` before reaching the `handler`.
*   **Stack Leak Prevention**: All tool errors must be caught and transformed into standard JSON-RPC error codes. Internal C++ or Node.js stack traces must be stripped in production.
*   **Auth Consistency**: MCP stdio transport assumes local trust. However, for multi-tenant deployments, `tenantId` must be cryptographically bound to the session.

## 2. Vulnerability Assessment

| ID | Vulnerability | Severity | Status |
| --- | --- | --- | --- |
| SEC-01 | JSON-RPC Integer Overflow | LOW | Mitigated by modern JSON parsers. |
| SEC-02 | Unbounded Tool Output | HIGH | RISK: Large tool results can OOM the orchestrator. |
| SEC-03 | Request Correlation Smuggling | MEDIUM | RISK: Lack of `correlationId` allows request mis-mapping. |
| SEC-04 | Logic Injection via Meta | LOW | RISK: Handler trust in `metadata` fields. |

## 3. Hardening Recommendations

### Mandatory Output Caps
Limit the total byte size of `result` blocks returned by tools to 2MB. If exceeded, return a `CAS_REFERENCE` instead of the raw data.

### Request-Level Policy
Apply the `default.policy.json` (from root `/policy`) at the MCP entry point for every tool call, not just the final execution layer.

### Deterministic Digests
Compute a BLAKE3 digest of the *entire* tool result. Verify this digest matches during replay to prevent "Silent Tool Drift."

---
**Status**: REVIEW COMPLETE - Root policy integration recommended.
