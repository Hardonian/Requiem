# MCP Recipe System

MCP recipes are stored in `mcp/*.mcp.json` and define multi-step workflows.

## Recipe fields

- `id`
- `parallel` (parallel execution support)
- `retry.max_attempts`
- `steps[]` with named `run` targets
- `on_failure.branch`

## CLI

- `rl repo mcp run <recipe-id>`

Recipes currently include:
- `repo_health_scan`
- `full_refactor_pass`
- `release_preflight`
- `ci_failure_recovery`
