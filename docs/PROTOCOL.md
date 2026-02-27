# Requiem Protocol Specification

## Version

Protocol version: **v1**
Engine version: **0.7.0**

## Wire Format

Requiem currently operates as a CLI executable. The protocol is JSON-over-stdio:

- **Request**: JSON object read from file (specified via `--request`)
- **Result**: JSON object written to file (specified via `--out`)
- **Health/Doctor**: JSON written to stdout

## Handshake

Before using the engine, callers must verify:

```bash
requiem health
```

Expected response:
```json
{
  "hash_primitive": "blake3",
  "hash_backend": "vendored",
  "hash_version": "1.5.4",
  "hash_available": true,
  "compat_warning": false
}
```

**Fail-closed rule**: If `hash_primitive` is not `blake3` or `hash_backend` is `fallback` or `unavailable`, the engine must not be used.

## Request Format

See `docs/CONTRACT.md` for the complete JSON schema.

Key fields:
- `command`: executable path (required)
- `argv`: argument array
- `workspace_root`: confinement root (default: `.`)
- `policy.deterministic`: enable deterministic execution (default: `true`)
- `timeout_ms`: execution timeout (default: `5000`)

## Result Format

Key fields:
- `ok`: boolean success
- `exit_code`: process exit code
- `request_digest`: BLAKE3 hex digest of canonical request
- `result_digest`: BLAKE3 hex digest of canonical result
- `stdout_digest`, `stderr_digest`, `trace_digest`: content digests

## Environment Variable Handling

1. **FORCE_RUST=1**: Disables Requiem engine (exit code 3), allowing caller to fall back to Rust engine
2. **FORCE_REQUIEM=1**: Reserved for future use — signals caller must use Requiem only

## Error Codes

| Code | Description |
|------|-------------|
| `hash_unavailable_blake3` | BLAKE3 not available (should never happen with vendored) |
| `path_escape` | Path escapes workspace root |
| `timeout` | Execution exceeded timeout |
| `quota_exceeded` | Request payload too large or too many outputs |
| `json_parse_error` | Invalid JSON |
| `json_duplicate_key` | Duplicate keys in JSON |
