# Reach CLI Reference

The Reach CLI (`requiem` / `reach`) is the command-line interface for the Requiem engine.

## Installation

```bash
# From the monorepo
cd packages/cli
pnpm install
pnpm run build

# The CLI is available as both `requiem` and `reach`
```

## Commands

### `requiem tool list`

List all registered AI tools.

```bash
requiem tool list [--json] [--capability <cap>] [--tenant-scoped] [--deterministic]
```

### `requiem tool exec <name>`

Execute a registered tool by name.

```bash
requiem tool exec <name> --input '{"key":"value"}' [--tenant <id>] [--actor <id>] [--timeout <ms>] [--json]
```

### `requiem replay <hash>`

Look up an audit replay record by its content hash.

```bash
requiem replay <hash> [--tenant <id>] [--json]
```

### `requiem decide`

Decision engine operations.

| Subcommand | Description |
|------------|-------------|
| `evaluate --junction <id>` | Evaluate a decision for a junction |
| `explain --junction <id>` | Explain why a decision was made |
| `outcome --id <id> --status <status>` | Record an outcome |
| `list` | List all decision reports |
| `show <id>` | Show decision details |

### `requiem junctions`

Junction lifecycle management.

| Subcommand | Description |
|------------|-------------|
| `scan --since <time>` | Scan for junctions (e.g., `7d`, `24h`, `30m`) |
| `list` | List all junctions |
| `show <id>` | Show junction details |

### `requiem agent serve`

Start an MCP stdio server for AI agent orchestration.

```bash
requiem agent serve --tenant <id> [--json]
```

### `requiem ai`

AI tools, skills, and telemetry management.

| Subcommand | Description |
|------------|-------------|
| `tools list` | List registered AI tools |
| `skills list` | List AI skills |
| `skills run <name>` | Run an AI skill |
| `telemetry` | Show cost and usage telemetry |

### `requiem doctor`

Validate the environment: checks Node.js version, tool registry, critical tools, and required environment variables.

```bash
requiem doctor [--json]
```

### `requiem version`

Show CLI version.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DECISION_ENGINE` | Engine type: `ts` or `requiem` (default: `ts`) |
| `FORCE_RUST` | Force TypeScript fallback: `true`/`false` |
| `REQUIEM_ENGINE_AVAILABLE` | Set to `true` if native engine is built |
| `REQUIEM_WORKSPACE_ROOT` | Workspace root path |
| `REQUIEM_TENANT_ID` | Default tenant ID |
