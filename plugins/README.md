# Plugin Model (Feasibility + Safety)

Requiem already supports descriptor-based plugin discovery for workflow adapters via `plugins/*/plugin.json`.

## Current Status

- ✅ Feasible now for **configuration-style plugins** (descriptor + adapter wiring).
- ✅ Feasible now for **CLI plugin lifecycle operations** (`plugin:list/install/enable/disable`).
- ⚠️ Not yet safe for arbitrary code execution from third-party plugins.

## Safe Plugin Boundary

Plugins are allowed to:

1. Publish metadata and declared capabilities.
2. Register deterministic adapter behavior through declarative config.
3. Provide optional workflow templates and policy snippets.

Plugins are not allowed to:

1. Mutate core runtime state directly.
2. Access tenant data without explicit context handoff.
3. Override policy, auth, or tenancy checks.
4. Bypass trace/audit semantics.

## Discovery Contract

Every plugin should expose:

- `plugin.json` (identity + capabilities + enablement defaults)
- Optional `workflow.ts`/`policy.ts` for authoring reference only
- `plugin-interface.ts` compatibility through a manifest schema

## Recommended Loading Policy

1. Validate manifest schema and declared permissions before load.
2. Require explicit operator enablement (`plugin:enable`).
3. Scope plugin invocation by tenant and route/command permission.
4. Record plugin name/version in execution metadata for provenance.
5. Reject plugins declaring unsupported interface versions.

