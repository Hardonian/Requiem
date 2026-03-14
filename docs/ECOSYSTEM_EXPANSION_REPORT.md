# ECOSYSTEM_EXPANSION_REPORT

## 1) Extension Point Map (EXTENSION_POINT_MAP)

| Component | Extension type | Stability | Security implications | Recommended interface |
|---|---|---|---|---|
| Next API routes (`ready-layer/src/app/api/**`) | API route handlers | Medium-High | Tenant/auth/policy bypass risk if unguarded | `withTenantContext` + `ProblemError` + schema validation |
| ReadyLayer middleware | Request middleware chain | High | Header spoofing, trace loss, auth drift | `middleware/proxy.ts` conventions + mandatory trace/request IDs |
| CLI command router | CLI command plugins/extensions | Medium | Privilege escalation through direct core calls | command registry with permission-scoped plugin commands |
| Workflow platform library | Workflow/task plugins | Medium | Non-deterministic actions, unsafe adapter behavior | declarative workflow JSON + manifest-gated adapters |
| Plugin directory (`plugins/*`) | Config + adapter extension | Medium | Descriptor tampering, unauthorized enablement | `PluginManifest` (`plugins/plugin-interface.ts`) |
| Agent adapter registry | External agent/tool adapters | Medium | Data exfiltration, unbounded network use | `AgentAdapter` capability declaration + health checks |
| Policy engine | Policy rule injection | High | Default-allow regression would be critical | deny-by-default `PolicyEngine` contracts |
| Route wrapper (`withTenantContext`) | SDK hook for API wrappers | High | Rate-limit/cache/idempotency partition bleed | tenant-keyed rate/cache/idempotency + structured logs |
| Repo automation commands | Multi-repo orchestration | Medium | unverified remote execution claims | recipe-based execution + explicit capability declaration |

## 2) Capability graph summary

See `docs/CAPABILITY_GRAPH.md` for nodes, dependencies, permission boundaries, and execution flow.

## 3) Plugin feasibility results

- **Configuration plugins:** feasible now (descriptor model exists).
- **CLI command plugins:** feasible with command registry hardening.
- **API extension plugins:** feasible only through route-wrapper contracts, not arbitrary route patching.
- **Workflow/task plugins:** feasible if constrained to declarative nodes + approved adapters.

Conclusion: plugin system is justified, but must stay manifest-first and deny-by-default.

## 4) Orchestration model summary

A minimal deterministic orchestrator already exists (enqueue -> worker -> workflow -> proof/replay artifacts) and can be promoted via an SPI without breaking core.

## 5) Multi-repo execution feasibility

Feasible for command/recipe orchestration through `rl repo` capabilities, with limitations around distributed transactions and remote scheduler guarantees.

## 6) Ecosystem safety rules

See `docs/EXTENSIBILITY_RULES.md` for mandatory controls.

## 7) Example implementations added

- `examples/plugin-example/` manifest validation and capability discovery.
- `examples/cli-extension-example/` deterministic command extension contract.
- `examples/orchestration-example/` deterministic queue orchestration simulation.

## 8) Integration opportunities

- CI runner integration through `pnpm` verify scripts.
- MCP bridge integration for tool-driven agents.
- Agent adapter integration via `packages/core/src/agent-adapter.ts`.
- API orchestration via tenant-aware route wrapper.

## ECOSYSTEM_READINESS_SCORE

**132 / 150 — extensible but early**

Rationale:

- Strong deterministic and policy primitives already exist.
- Practical plugin/orchestration scaffolding exists.
- Core still needs stricter interface enforcement and signed capability discovery for ecosystem-scale trust.

