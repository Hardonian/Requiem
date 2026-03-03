# Requiem CLI Contract

> **Status:** FROZEN — Contract stable for v1.x  
> **Last Updated:** 2026-03-02  
> **Enforcement:** CI fails on breaking changes

## Overview

This document defines the stable CLI surface of the Requiem engine. All commands, flags, exit codes, and output formats are contractually bound. Breaking changes require a major version bump per `schema_versioning.md`.

## Exit Codes

| Code | Meaning | Usage |
|------|---------|-------|
| `0` | Success | Command completed successfully |
| `1` | General error | Unrecoverable error (see stderr) |
| `2` | Validation/blocker error | Input invalid or preconditions not met |
| `3` | Engine disabled | `FORCE_RUST=1` fallback triggered |
| `124` | Timeout | Process execution timed out |
| `128+N` | Fatal signal | Process killed by signal N |

## Global Flags

All commands accept these flags:

| Flag | Type | Description |
|------|------|-------------|
| `--json` | boolean | Force JSON output (machine-parseable) |
| `--help` | boolean | Show help text |
| `--version` | boolean | Show version info |

## Core Commands

### `doctor [--json] [--analyze] [--error-code CODE] [--error-detail DETAIL]`

Health check and diagnostic analysis.

**Exit Codes:**
- `0` — All checks passed
- `2` — One or more blockers detected

**JSON Output (stable fields):**
```json
{
  "ok": boolean,
  "blockers": string[],
  "engine_version": string,
  "protocol_version": string,
  "hash_primitive": "blake3",
  "hash_backend": "vendored|native|fallback",
  "hash_version": string,
  "sandbox": {
    "workspace_confinement": boolean,
    "rlimits": boolean,
    "seccomp": boolean,
    "job_objects": boolean,
    "restricted_token": boolean
  },
  "cluster": {
    "ok": boolean,
    "version_match": boolean
  }
}
```

### `health`

Print engine capability and hash info.

**JSON Output:**
```json
{
  "hash_primitive": "blake3",
  "hash_backend": string,
  "hash_version": string,
  "hash_available": boolean,
  "compat_warning": boolean,
  "cas_version": "v2",
  "compression_capabilities": ["identity", "zstd"?]
}
```

### `version`

Print version information.

**JSON Output:**
```json
{
  "engine": string,
  "protocol": "v1",
  "api": "v2"
}
```

### `validate-replacement`

Certification check for engine replacement.

**Exit Codes:**
- `0` — Certified as replacement-ready
- `2` — Blockers found (see `blockers` array)

**JSON Output:**
```json
{
  "ok": boolean,
  "blockers": string[],
  "hash_primitive": string,
  "hash_backend": string
}
```

## Execution Commands

### `exec run --request <file>`

Execute a tool request deterministically.

**Exit Codes:**
- `0` — Execution successful
- `1` — Execution failed (see error_code)
- `124` — Timeout

**JSON Output (stable fields):**
```json
{
  "ok": boolean,
  "exit_code": number,
  "error_code": string | null,
  "termination_reason": "" | "timeout" | "error",
  "stdout": string,
  "stderr": string,
  "stdout_truncated": boolean,
  "stderr_truncated": boolean,
  "request_digest": string (64 hex chars),
  "trace_digest": string (64 hex chars),
  "result_digest": string (64 hex chars),
  "stdout_digest": string (64 hex chars),
  "stderr_digest": string (64 hex chars),
  "output_digests": { [path: string]: string (64 hex chars) }
}
```

### `exec replay --result-digest <hash> --request <file>`

Verify an execution against a result digest.

**Exit Codes:**
- `0` — Replay matches
- `1` — Replay mismatch or error

**JSON Output:**
```json
{
  "ok": boolean,
  "match": boolean,
  "expected_digest": string,
  "actual_digest": string | null,
  "error": string | null
}
```

## CAS Commands

### `cas put --file <path>`

Store content in content-addressable storage.

**Exit Codes:**
- `0` — Stored successfully
- `1` — Error (see stderr)

**JSON Output:**
```json
{
  "digest": string (64 hex chars),
  "size_bytes": number
}
```

### `cas get --digest <hash>`

Retrieve content from CAS by digest.

**Exit Codes:**
- `0` — Retrieved successfully
- `1` — Not found or error

**Output:** Raw content (not JSON wrapped).

### `cas verify`

Verify all CAS objects for integrity.

**Exit Codes:**
- `0` — All objects valid
- `1` — One or more objects corrupt

**JSON Output:**
```json
{
  "ok": boolean,
  "total": number,
  "verified": number,
  "corrupt": number,
  "missing": number
}
```

## Policy Commands

### `policy check --request <file>`

Verify a request against active policy.

**Exit Codes:**
- `0` — Allowed
- `1` — Denied or error

**JSON Output:**
```json
{
  "ok": boolean,
  "allowed": boolean,
  "reason": string | null
}
```

### `policy add --file <path>`

Add a policy rule set to CAS.

**Exit Codes:**
- `0` — Added successfully
- `1` — Invalid policy

**JSON Output:**
```json
{
  "ok": boolean,
  "digest": string | null,
  "error": string | null
}
```

### `lint <policy-file>`

Validate policy syntax and structure.

**Exit Codes:**
- `0` — Valid
- `1` — Invalid (see errors array)

**JSON Output:**
```json
{
  "valid": boolean,
  "errors": string[],
  "warnings": string[]
}
```

## Capability Commands

### `caps mint --subject <id> --scopes <list> --secret-key <file> --public-key <file>`

Issue a capability token.

**⚠️ SECURITY CONTRACT:** Returns **fingerprint only**, never the token itself. The caller must persist the token before this command exits.

**Exit Codes:**
- `0` — Minted successfully
- `2` — Missing required arguments

**JSON Output:**
```json
{
  "ok": true,
  "fingerprint": string (64 hex chars),
  "subject": string,
  "scopes": string[],
  "not_before": number (unix timestamp),
  "not_after": number (unix timestamp)
}
```

**Prohibited Fields (must never appear):**
- `token` — The raw token must not be returned
- `secret_key` — Never echo back secrets

### `caps inspect --token <file>`

Inspect a capability token.

**Exit Codes:**
- `0` — Inspection successful
- `2` — Invalid token or missing file

**JSON Output:**
```json
{
  "ok": boolean,
  "fingerprint": string,
  "subject": string,
  "permissions": string[],
  "not_before": number,
  "not_after": number,
  "issuer_fingerprint": string,
  "cap_version": number
}
```

### `caps list [--tenant <id>]`

List all minted capabilities.

**Exit Codes:**
- `0` — Success

**JSON Output:**
```json
{
  "capabilities": [
    {
      "actor": string,
      "seq": number,
      "data_hash": string
    }
  ]
}
```

## Plan Commands

### `plan add --file <path>`

Add a plan with steps to the store.

**Exit Codes:**
- `0` — Added successfully
- `1` — Invalid plan

**JSON Output:**
```json
{
  "ok": boolean,
  "digest": string | null,
  "error": string | null
}
```

### `plan run --digest <hash>`

Execute a plan DAG with receipt anchoring.

**Exit Codes:**
- `0` — Plan completed successfully
- `1` — Plan failed (see error details)

**JSON Output:**
```json
{
  "ok": boolean,
  "run_id": string,
  "receipt_hash": string | null,
  "steps_completed": number,
  "steps_total": number,
  "error": string | null
}
```

### `plan verify --digest <hash>`

Validate a plan DAG (cycle/dep check).

**Exit Codes:**
- `0` — Valid DAG
- `1` — Invalid (cycle or missing dependencies)

**JSON Output:**
```json
{
  "ok": boolean,
  "valid": boolean,
  "errors": string[]
}
```

## Event Log Commands

### `log verify`

Verify event log prev-hash chain integrity.

**Exit Codes:**
- `0` — Chain intact
- `1` — Chain broken or corrupted

**JSON Output:**
```json
{
  "ok": boolean,
  "entries_checked": number,
  "breaks": [
    {
      "seq": number,
      "expected_prev": string | null,
      "actual_prev": string | null
    }
  ]
}
```

## Hash Commands

### `digest file <path>`

Compute BLAKE3 fingerprint of a file.

**Exit Codes:**
- `0` — Computed successfully
- `1` — File not found or error

**JSON Output:**
```json
{
  "digest": string (64 hex chars),
  "size_bytes": number,
  "algorithm": "blake3"
}
```

## Contract Evolution

### Additive Changes (Allowed in Minor Versions)

- New optional fields in JSON output
- New commands (not subcommand changes to existing)
- New optional flags
- New error codes (distinct from existing)

### Breaking Changes (Require Major Version)

- Removing or renaming fields
- Changing field types
- Changing exit code meanings
- Removing commands
- Making optional fields required

### Deprecation Process

1. Mark field/command as deprecated in documentation
2. Add compatibility shim (alias)
3. Emit deprecation warning (if interactive)
4. Remove only in next major version

## Testing Contract Compliance

Run contract verification:

```bash
make verify:contracts
```

This validates:
- CLI help output matches documented commands
- JSON output shapes match contract
- Exit codes are as documented
- No breaking changes from baseline snapshots
