# CLI Command Schema

## Command Registry

All CLI commands follow standardized patterns for arguments, flags, and output.

### Global Flags

Every command supports these global flags:

| Flag | Type | Description |
|------|------|-------------|
| `--json` | boolean | Output in JSON format |
| `--minimal` | boolean | Quiet deterministic output |
| `--explain` | boolean | Verbose structural reasoning |
| `--trace` | boolean | Include trace information |
| `--help`, `-h` | boolean | Show help for command |
| `--version`, `-v` | boolean | Show version information |

### Standardized Flag Patterns

| Pattern | Usage | Example |
|---------|-------|---------|
| `--tenant <id>` | Specify tenant context | `reach run tool --tenant acme-corp` |
| `--subject <id>` | Specify subject/user | `reach run tool --subject user-123` |
| `--from <id>` | Source reference | `reach state diff --from state-a` |
| `--to <id>` | Target reference | `reach state diff --to state-b` |
| `--format <type>` | Output format | `reach diff run1 run2 --format json` |

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success / Determinism verified |
| `1` | Generic failure |
| `2` | Usage error (invalid arguments) |
| `3` | Config error |
| `4` | Network/provider error |
| `5` | Policy/quota denied |
| `6` | Signature verification failed |
| `7` | Invariant/determinism/replay drift |
| `8` | System/resource error |
| `9` | Timeout/cancellation |

### Error Envelope Format

All CLI errors return a consistent structure:

```json
{
  "success": false,
  "error": {
    "code": "E_ERROR_CODE",
    "message": "Human-readable error message",
    "severity": "error|warn|fatal",
    "timestamp": "2026-03-02T22:58:21.420Z"
  },
  "traceId": "abc123-def456",
  "durationMs": 42
}
```

## Command Categories

### Control Commands

| Command | Args | Flags |
|---------|------|-------|
| `run <name> [input]` | `name`: tool name, `input`: JSON input | `--tenant`, `--subject` |
| `verify <hash>` | `hash`: execution hash | `--format` |
| `replay run <id>` | `id`: run identifier | `--tenant` |
| `replay diff <a> <b>` | `a`, `b`: run identifiers | `--format` |

### Observability Commands

| Command | Args | Flags |
|---------|------|-------|
| `trace <id>` | `id`: trace identifier | `--format` |
| `stats` | None | `--format`, `--from`, `--to` |
| `status` | None | `--format` |
| `telemetry` | None | `--format`, `--from`, `--to` |

### State Management Commands

| Command | Args | Flags |
|---------|------|-------|
| `state list` | None | `--tenant`, `--format` |
| `state show <id>` | `id`: state identifier | `--format` |
| `state diff <a> <b>` | `a`, `b`: state identifiers | `--format` |

## JSON Output Stability

All JSON output uses stable key ordering:
1. `success` (boolean)
2. `data` or `error` (object)
3. `traceId` (string)
4. `durationMs` (number)
5. `timestamp` (string)

Keys are sorted alphabetically within each object.
