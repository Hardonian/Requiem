# MCP (Model Context Protocol)

> MCP server implementation for Requiem - to be populated during Phase 3.

## Overview

The Model Context Protocol (MCP) enables AI assistants to interact with the Requiem system through a standardized interface.

## Protocol Specification

### Transport

- **Stdio**: Local process communication
- **HTTP**: Remote server communication (future)

### Message Format

```json
{
  "jsonrpc": "2.0",
  "id": "unique-id",
  "method": "tool_name",
  "params": {
    // tool-specific parameters
  }
}
```

### Response Format

```json
{
  "jsonrpc": "2.0",
  "id": "unique-id",
  "result": {
    // tool-specific result
  }
}
```

### Error Format

```json
{
  "jsonrpc": "2.0",
  "id": "unique-id",
  "error": {
    "code": -32600,
    "message": "Error description",
    "data": {}
  }
}
```

## Tools Contract

*(To be implemented in Phase 1)*

### Tool Registry

| Tool | Description | Parameters | Returns |
|------|-------------|------------|---------|
| `decide_evaluate` | Evaluate a decision | `junction_id: string` | `DecisionReport` |
| `decide_explain` | Explain a decision | `decision_id: string` | `Explanation` |
| `junctions_list` | List junctions | `filter?: JunctionFilter` | `Junction[]` |
| `junctions_show` | Show junction details | `id: string` | `Junction` |

### Tool Definition Schema

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  handler: ToolHandler;
}
```

## Server Implementation

*(To be implemented in Phase 3)*

### Entry Point

```
packages/mcp/src/server.ts
```

### Request Routing

1. Parse JSON-RPC request
2. Validate method existence
3. Check policy permissions (Phase 2)
4. Execute tool handler
5. Return result or error

## Policy Gating

*(To be implemented in Phase 2)*

Tools are gated by:
- Tenant isolation
- RBAC permissions
- Rate limiting
- Tool-specific policies

---

**Status**: Initial scaffold - to be populated during implementation phases.
