# EXTENSION_POINT_MAP

| component | extension type | stability level | security implications | recommended interface |
|---|---|---|---|---|
| `ready-layer/src/app/api/*` | API route extension | medium-high | auth/policy bypass, tenant bleed | `withTenantContext`, `parseJsonWithSchema`, `ProblemError` |
| `ready-layer/src/middleware/proxy.ts` | middleware hooks | high | header spoofing, trace loss | centralized middleware proxy + explicit public/protected route checks |
| `packages/cli/src/commands/*` | CLI command extension | medium | command-level privilege bypass | routed command registry and permission-scoped command groups |
| `packages/cli/src/lib/workflow-platform.ts` | workflow/task adapters | medium | nondeterminism, unsafe side effects | declarative workflow graph + policy hooks + deterministic state hashing |
| `plugins/*/plugin.json` | plugin descriptors | medium | malicious descriptors or hidden behaviors | manifest validation via `plugins/plugin-interface.ts` |
| `packages/core/src/agent-adapter.ts` | agent/tool adapters | medium | exfiltration, opaque behavior | `AgentAdapter` capability and health interfaces |
| `packages/core/src/policy-governance.ts` | policy injection | high | default-allow regressions | deny-by-default policy engine + proof hashes |
| `routes.manifest.json` / OpenAPI route | capability discovery feed | medium | stale or inaccurate capability claims | generated manifests + verification gates |
| `packages/cli/src/rl-cli.ts` (`repo *`) | multi-repo orchestration | medium | unverified remote execution semantics | recipe-driven execution + explicit outcome artifacts |

