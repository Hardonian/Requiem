# Tool Adapter SDK

Requiem runtime adapters implement a stable `ToolAdapter` contract:

- `tool_metadata` (`name`, `version`, `schema_hash`, capability descriptors)
- `preflight_checks()` (env/dependency/permission checks)
- `error_normalizer()` (raw error → stable normalized error)
- `classifier_extensions` (optional tool-specific mappings)
- `repair_generator` (optional repair step generator)
- `permission_descriptors` (least-privilege scopes + intent)

Built-ins shipped in phase 2:

1. `github.api`
2. `http.fetch`
3. `postgres.supabase`

Registry loading:

- static built-ins loaded via `initializeAdapterRegistry()`
- optional dynamic plugin lookup from `globalThis.__REQUIEM_ADAPTER_PLUGINS`
- compatibility gate: runtime contract major version `1.x`
