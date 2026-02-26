# Requiem Contract (v0.2)

## ExecRequest (JSON)
Required:
- `command` string

Optional/backward compatible:
- `request_id`, `argv[]`, `cwd`, `workspace_root`
- `env` map
- `inputs` map
- `outputs[]`
- `timeout_ms`, `max_output_bytes`
- `policy` object: `deterministic`, `allow_outside_workspace`, `inherit_env`, `env_allowlist[]`, `env_denylist[]`

## ExecResult (JSON)
- `ok`, `exit_code`, `error_code`
- `termination_reason` (`timeout` when watchdog kills process)
- `stdout`, `stderr`
- `stdout_truncated`, `stderr_truncated`
- `request_digest`, `trace_digest`, `result_digest`
- `output_digests` map
- `trace.events[]` with `{seq,t_ns,type,data}`

## Digest invariants
`result_digest` hashes canonical JSON containing:
- `request_digest`
- `ok`, `exit_code`, `termination_reason`
- `stdout_digest`, `stderr_digest`
- `trace_digest`
- sorted `output_digests`
