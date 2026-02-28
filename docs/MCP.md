# MCP (Model Context Protocol)

> Tool registry implementation for Requiem - populated in Phase 1.

## Overview

The Model Context Protocol (MCP) for Requiem provides a standardized interface for AI agents to discover and execute tools safely.

## Endpoints

### `GET /api/mcp/health`

Returns the operational status of the MCP server.

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-02-27T21:30:00.000Z"
}
```

### `GET /api/mcp/tools`

Lists all available tools in the registry. Requires authentication.

**Response (200 OK):**
```json
{
  "tools": [
    {
      "name": "datastore_decision_findById",
      "version": "1.0.0",
      "description": "Finds a decision report by its unique ID.",
      // ... other ToolDefinition properties
    }
  ]
}
```

### `POST /api/mcp/tool/call`

Invokes a tool with the given input, subject to policy gating. Requires authentication.

**Request Body:**
```json
{
  "toolName": "datastore_decision_findById",
  "input": {
    "id": "decision_123"
  }
}
```

**Response (200 OK):**
```json
{
  "result": {
    "id": "decision_123",
    // ... other DecisionReport properties
  }
}
```

**Error Responses:**
- **400 Bad Request:** Input fails schema validation.
- **401 Unauthorized:** Invalid or missing authentication.
- **403 Forbidden:** Policy gate denied the invocation.
- **500 Internal Server Error:** The tool failed during execution.

## Tool Definition Contract

Tools are defined via the `ToolDefinition` interface in `@requiem/ai/tools/registry`:

```typescript
interface ToolDefinition<Input = ZodSchema, Output = ZodSchema> {
  name: string;           // unique identifier (e.g., "decide_evaluate")
  version: string;         // semver string (e.g., "1.0.0")
  description: string;    // human-readable description
  inputSchema: ZodSchema; // Zod schema for input validation
  outputSchema: ZodSchema;// Zod schema for output validation
  deterministic: boolean; // can be replayed with same output
  sideEffect: boolean;    // modifies state outside tool
  idempotent: boolean;    // calling multiple times = once
  cost?: ToolCost;       // optional cost estimate
  requiredCapabilities: string[];  // RBAC capabilities needed
  tenantScoped: boolean;  // default true
}
```

### Versioning Rules

1. **Semantic Versioning**: Tools MUST use semver (e.g., "1.0.0", "2.1.3")
2. **Major Version Bump**: When making breaking changes to input/output schema
3. **Minor Version Bump**: When adding new optional parameters (backward compatible)
4. **Patch Version Bump**: When fixing bugs without schema changes
5. **Latest Version**: `getTool(name)` returns the highest version by semver

### Tool Registration

```typescript
import { registerTool, ToolDefinition, z } from '@requiem/ai/tools/registry';

const myTool: ToolDefinition = {
  name: 'my_tool',
  version: '1.0.0',
  description: 'Does something useful',
  inputSchema: z.object({ param: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  deterministic: false,
  sideEffect: true,
  idempotent: false,
  requiredCapabilities: ['tool:my_tool'],
  tenantScoped: true,
};

registerTool(myTool, async (ctx, input) => {
  // Tool implementation
  return { result: 'done' };
});
```

### Tool Invocation

```typescript
import { invokeTool, InvocationContext } from '@requiem/ai/tools/registry';

const ctx: InvocationContext = {
  tenantId: 'tenant_123',
  actorId: 'agent_456',
  requestId: 'req_789',
  capabilities: ['tool:my_tool'],
  environment: 'production',
};

const result = await invokeTool(ctx, 'my_tool', { param: 'value' });
// Returns: { success: boolean, output?: unknown, error?: ToolError, latencyMs: number }
```

## Policy Gating

All tool invocations are gated by the policy system which enforces:
- **Tenant Isolation**: Tools scoped to tenants cannot be accessed across tenant boundaries
- **RBAC**: Required capabilities are checked against actor's capabilities
- **Schema Validation**: Input and output are validated against tool schemas
- **Audit Trail**: All invocations are logged with structured context
