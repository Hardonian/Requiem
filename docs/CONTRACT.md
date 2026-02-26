# Requiem Contract (v0.5)

## ExecRequest (JSON)
Required:
- `command` string

Optional/additive fields:
- `request_id`, `argv[]`, `cwd`, `workspace_root`
- `env` map
- `inputs` map
- `outputs[]`
- `timeout_ms`, `max_output_bytes`
- `policy` object:
  - `mode` (`strict|compat`)
  - `env_allowlist[]`, `env_denylist[]`, `required_env{}`
  - `time_mode` (`fixed_zero` by default)

## ExecResult (JSON)
- `ok`, `exit_code`, `error_code`
- `termination_reason` (`timeout` when watchdog kills process)
- `stdout`, `stderr`
- `stdout_truncated`, `stderr_truncated`
- `request_digest`, `trace_digest`, `stdout_digest`, `stderr_digest`, `result_digest`
- `output_digests` map
- `policy_applied` key-only summary (no env values)
- `trace_events[]` with `{seq,t_ns,type,data}`

## Error codes
`json_parse_error`, `json_duplicate_key`, `path_escape`, `missing_input`, `spawn_failed`, `timeout`, `cas_integrity_failed`, `replay_failed`, `drift_detected`.

## CAS v2
- CAS root: `.requiem/cas/v2`
- Object key is hash of **original bytes** only.
- Storage metadata tracks: `encoding`, `original_size`, `stored_size`, `stored_blob_hash`.
- Encodings: `identity`, optional `zstd`.
