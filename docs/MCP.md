# MCP (Model Context Protocol)

The Model Context Protocol (MCP) for Requiem provides a standardized HTTP interface for AI agents to discover and execute tools safely.

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

## Tool Definition

Tools are defined via the `ToolDefinition` interface:

```typescript
interface ToolDefinition {
  name: string;
  version: string; // e.g., "1.0.0"
  description: string;
  inputSchema: z.ZodType<any>;
  outputSchema: z.ZodType<any>;
  deterministic: boolean;
  sideEffect: boolean;
  idempotent: boolean;
  cost?: {
    costCents?: number;
    latency?: 'low' | 'medium' | 'high';
  };
  requiredCapabilities: string[];
  tenantScoped: boolean;
}
```

## Policy Gating

All tool calls made through the `/api/mcp/tool/call` endpoint are gated by the policy engine, which enforces tenant isolation, RBAC, and other safety constraints.
