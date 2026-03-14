# Requiem Capability Graph

This document defines an evidence-based capability graph for Requiem’s current platform surface and safe extension boundaries.

## Capability Nodes

| Node | Description | Current Primitive |
|---|---|---|
| `cap.route.execute` | Execute authenticated tenant-scoped API routes with policy/rate/idempotency controls. | `withTenantContext` and route handlers in `ready-layer/src/app/api/**`. |
| `cap.cli.orchestrate` | Execute deterministic CLI commands for workflows, replay, plugin toggles, and diagnostics. | `packages/cli/src/cli.ts`, `packages/cli/src/commands/platform-expansion.ts`. |
| `cap.workflow.run` | Run deterministic workflow graphs and emit replay/proof artifacts. | `runWorkflow` in `packages/cli/src/lib/workflow-platform.ts`. |
| `cap.workflow.queue` | Queue and drain workflow tasks through local worker state. | `enqueueWorkflow`, `workerStart`, `clusterStatus`. |
| `cap.plugin.discover` | Discover, install, and enable plugin descriptors from `plugins/*/plugin.json`. | `listPlugins`, `installPlugin`, `setPluginEnabled`. |
| `cap.agent.adapter` | Register/invoke external agent adapters under deterministic execution contracts. | `AgentAdapter` + `AgentRegistry` in `packages/core/src/agent-adapter.ts`. |
| `cap.policy.evaluate` | Enforce deny-by-default policy decisions and produce decision proof hashes. | `PolicyEngine` in `packages/core/src/policy-governance.ts`. |
| `cap.tenant.isolate` | Maintain tenant/actor/request scoping across middleware, API, and policy layers. | `ready-layer/src/middleware/proxy.ts`, `withTenantContext`. |
| `cap.config.inject` | Inject runtime behavior through env + workflow/plugin JSON descriptors without patching core. | middleware env checks + `workflow-platform` JSON loaders. |
| `cap.audit.observe` | Emit machine-readable request completion/failure events and trace headers. | structured logs + `x-trace-id`/`x-request-id` propagation in API/middleware. |

## Dependency Graph

```text
cap.config.inject
   ├─> cap.plugin.discover
   ├─> cap.route.execute
   └─> cap.cli.orchestrate

cap.tenant.isolate
   ├─> cap.route.execute
   ├─> cap.workflow.queue
   └─> cap.audit.observe

cap.policy.evaluate
   ├─> cap.route.execute
   ├─> cap.workflow.run
   └─> cap.agent.adapter

cap.plugin.discover
   ├─> cap.workflow.run
   └─> cap.cli.orchestrate

cap.workflow.run
   ├─> cap.workflow.queue
   └─> cap.audit.observe

cap.cli.orchestrate
   ├─> cap.workflow.run
   ├─> cap.workflow.queue
   ├─> cap.plugin.discover
   └─> cap.agent.adapter
```

## Permission Boundaries

1. **Tenant Boundary**
   - Route execution is tenant-bound through request context, auth validation, and tenant-keyed caches/rate limits.
2. **Policy Boundary**
   - Policy evaluation is explicit and deny-by-default when no rule matches.
3. **Execution Boundary**
   - Workflow and plugin behavior is constrained to descriptor-driven adapters and deterministic state hashing.
4. **Observability Boundary**
   - Every route response includes trace/request IDs and structured request lifecycle logs.

## Execution Flow (Route + Workflow)

1. Middleware resolves trace ID, applies public/protected routing checks, and annotates headers.
2. API handler calls `withTenantContext` to enforce auth, rate limit, idempotency, and policy evaluation.
3. Handler executes route logic or orchestration command.
4. For workflow execution, `runWorkflow` computes deterministic state transitions and proof artifacts.
5. Outputs are returned with trace/request headers and machine-readable error envelopes.

## Capability Discovery Model

Minimal discovery model to support ecosystem tooling:

- **Static discovery (current):**
  - CLI capability list from `cli.ts`/`platform-expansion.ts` command surface.
  - API capability list from `routes.manifest.json` + OpenAPI route.
  - Plugin capability list from plugin descriptors + enabled state.
  - Agent capability list from `AgentAdapter.capabilities()`.
- **Runtime discovery (recommended):**
  - A signed capability snapshot artifact emitted by CLI and API containing:
    - capability id
    - version
    - scope (`public`, `tenant`, `admin`)
    - enforcement hooks (`auth`, `policy`, `rateLimit`, `idempotency`)
    - deterministic guarantees (`required`, `best_effort`, `none`)

