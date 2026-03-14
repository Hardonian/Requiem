# Automation / Agent Integration Models

## Supported Today

1. **CLI Automation**
   - Deterministic command execution through `requiem` and `rl` command surfaces.

2. **LLM Tool Integration**
   - MCP endpoints (`/api/mcp/health`, `/api/mcp/tools`, `/api/mcp/tool/call`) plus agent tool listing commands.

3. **Agent Adapter Integration**
   - Core `AgentAdapter` interfaces for OpenAI-style, CLI, and custom adapters.

4. **CI/CD Integration**
   - Verification scripts + npm scripts for lint/typecheck/build/test and policy/security checks.

## Integration Safety Checklist

- Require explicit capability declaration.
- Require tenant-aware invocation context when data scoped.
- Enforce policy deny-by-default behavior on all integrated actions.
- Emit stable machine-readable results (`json`, problem+json, digest artifacts).

## Recommended Integration Modes

- **Mode A: CLI Runner** — CI job calls `pnpm` verify commands and captures artifacts.
- **Mode B: API Orchestrator** — external system uses API routes guarded by tenant context.
- **Mode C: Agent Registry** — external agent registers declared capabilities through adapter interface.
- **Mode D: MCP Tool Bridge** — agent toolchain accesses Requiem tools over MCP endpoints.

