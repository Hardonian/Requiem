# AI Scaffold Decisions

_Generated: 2026-02-28_

## Repo Context

- **Core**: C++ deterministic runtime (`src/*.cpp`, CMake)
- **AI Layer**: TypeScript (`packages/ai/`) — standalone, no circular deps
- **CLI**: TypeScript (`packages/cli/`) — orchestration + DB
- **Web**: Next.js 16 (`ready-layer/`) — dashboard + API routes
- **UI**: React (`packages/ui/`) — design system

## Key Decisions

### 1. packages/ai/ is Self-Contained

`packages/ai/` does NOT import from `packages/cli/` or `packages/ui/`.
This prevents circular dependencies and ensures the AI layer can be tested in isolation.

**Consequence**: Datastore tools (`packages/ai/src/tools/datastore.ts`) are stubbed.
Application code (ready-layer or CLI) registers concrete tool implementations.

### 2. Module Resolution: NodeNext + .js Extensions

All imports use explicit `.js` extensions (e.g., `./registry.js`).
Required by TypeScript's NodeNext/ESM module resolution.

### 3. File-Backed Dev Stores

For memory and cost telemetry, the default implementation writes to `.data/ai-*/`.
This is explicitly "dev only" — production replaces sinks via:
- `setMemoryStore(dbStore)`
- `setCostSink(dbSink)`
- `setAuditSink(dbSink)`

### 4. Auth in MCP Transport

`packages/ai/src/mcp/transport-next.ts` has a `resolveContext()` function.
In production, implement JWT validation there.
For local dev: set `REQUIEM_DEV_MODE=1` (loud warning emitted).

### 5. Budget Enforcement is Interface-Only

`packages/ai/src/policy/budgets.ts` provides `BudgetChecker` interface.
Default is pass-through (no limits). Wire real DB-backed checker via `setBudgetChecker()`.

### 6. Tenant Context

`TenantContext` is defined in `packages/ai/src/types/index.ts` (not imported from CLI).
This prevents coupling but means the application must bridge the two types when needed.

### 7. Eval Cases Schema

`eval/cases/*.json` uses a `{ cases: EvalCase[] }` wrapper.
The harness also accepts flat arrays for compatibility.

### 8. Circuit Breaker Defaults

- Failure threshold: 5 consecutive failures
- Recovery window: 30 seconds
- Success threshold for HALF_OPEN→CLOSED: 2

### 9. Migration Location

DB migrations for AI layer (if needed) go in `ready-layer/migrations/`.
Two migrations already exist:
- `20260228000000_vector_search_initial.sql`
- `20260228010000_ai_cost_records.sql`

### 10. No LLM Required for Core Tests

`system.echo`, `system.health`, `skill.tool_smoke`, and `skill.trace_summary`
all work without any LLM provider configured. Provider errors degrade gracefully.
