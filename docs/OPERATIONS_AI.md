# AI Control-Plane Operations

_Version: 0.1.0 | Updated: 2026-02-28_

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Optional | Anthropic Claude API key |
| `OPENAI_API_KEY` | Optional | OpenAI API key |
| `REQUIEM_DEV_MODE` | Dev only | Set to `1` to use single-tenant dev stub (loud warning) |
| `NODE_ENV` | Optional | `development`/`production`/`test` |

**SECURITY**: Never commit API keys. Use secret manager in production.

## Health Checks

### AI Layer Health
```
GET /api/mcp/health
```
Returns `{ status: "ok", tool_count: N, version: "0.1.0" }`.
No auth required. Use for load balancer health checks.

### Tool List
```
GET /api/mcp/tools
Authorization: Bearer <token>
```
Returns all registered tools. Requires valid auth.

## Startup Sequence

1. App starts
2. `import '@requiem/ai'` triggers:
   - Registers `system.echo@1.0.0`
   - Registers `system.health@1.0.0`
   - Registers `skill.trace_summary@1.0.0`
   - Registers `skill.tool_smoke@1.0.0`
3. Application registers additional tools (datastore, etc.)
4. MCP routes become available

## Development Sinks

In development mode, data is written to:
```
.data/ai-audit/   — audit records (ndjson, daily rotation)
.data/ai-cost/    — cost records (ndjson, daily rotation)
.data/ai-memory/  — memory items (ndjson, per-tenant file)
```

**These are dev-only.** Replace with DB sinks before production:
```typescript
import { setAuditSink, setCostSink, setMemoryStore } from '@requiem/ai';

setAuditSink(async (record) => { await db.insert(record); });
setCostSink(async (record) => { await db.insert(record); });
setMemoryStore(new DatabaseMemoryStore(db));
```

## Verify Scripts

```bash
# Run all AI verify scripts
pnpm run verify:ai

# Individual scripts
pnpm run verify:mcp            # MCP endpoints smoke test
pnpm run verify:ai-safety      # Policy gate red-team tests
pnpm run verify:agent-quality  # Eval regression gate
pnpm run verify:cost-accounting # Cost record structure/isolation
pnpm run verify:tenant-isolation # Memory + cost tenant isolation
```

## Circuit Breaker

Provider circuit breakers activate after **5 consecutive failures**.
Recovery window is **30 seconds**.

Check state: `getCircuitState('anthropic:claude-sonnet-4-6')`
Reset: `resetCircuit('anthropic:claude-sonnet-4-6')`

## Incident Response

### AI_CIRCUIT_OPEN
**Symptom**: LLM skill steps return circuit open error.
**Action**:
1. Check provider status page (status.anthropic.com / status.openai.com)
2. Wait for recovery window (30s) or reset manually
3. If persistent, check API key validity

### AI_TOOL_NOT_FOUND
**Symptom**: Tool call returns TOOL_NOT_FOUND.
**Action**:
1. Verify `import '@requiem/ai'` is called at startup
2. Check that custom tools are registered before first request
3. Verify tool name/version strings match exactly

### AI_POLICY_DENIED
**Symptom**: Tool call denied for authenticated user.
**Action**:
1. Check user's `TenantRole` in `InvocationContext.tenant.role`
2. Compare against tool's `requiredCapabilities`
3. See `packages/ai/src/policy/capabilities.ts` for role→capability mapping

### AI_BUDGET_EXCEEDED
**Symptom**: Operations denied due to budget.
**Action**:
1. Review `ai_cost_records` for tenant usage
2. Adjust budget limits in `BudgetChecker` implementation
3. Consider model arbitration to cheaper models

## DB Migrations

Located in `ready-layer/migrations/`:

- `20260228000000_vector_search_initial.sql` — vector search tables
- `20260228010000_ai_cost_records.sql` — `ai_cost_records` table

Run with: `cd ready-layer && npx prisma migrate dev`

## Runbook: Adding a New Tool

1. Create `packages/ai/src/tools/builtins/mytools.my_tool.ts`
2. Define `ToolDefinition` with schema, capabilities, tenantScoped
3. Register with `registerTool(def, handler)`
4. Import in `packages/ai/src/index.ts` bootstrap section
5. Add eval case in `eval/cases/`
6. Run `pnpm run verify:ai`
