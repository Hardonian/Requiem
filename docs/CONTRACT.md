# Requiem API Contract

## Execution Request

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["command"],
  "properties": {
    "request_id": {
      "type": "string",
      "description": "Unique identifier for this request"
    },
    "command": {
      "type": "string",
      "description": "Executable path or name"
    },
    "argv": {
      "type": "array",
      "items": {"type": "string"},
      "description": "Command arguments"
    },
    "env": {
      "type": "object",
      "additionalProperties": {"type": "string"},
      "description": "Environment variables"
    },
    "cwd": {
      "type": "string",
      "description": "Working directory (relative to workspace_root)"
    },
    "workspace_root": {
      "type": "string",
      "default": ".",
      "description": "Root directory for path confinement"
    },
    "inputs": {
      "type": "object",
      "additionalProperties": {"type": "string"},
      "description": "Input file digests (for cache validation)"
    },
    "outputs": {
      "type": "array",
      "items": {"type": "string"},
      "description": "Expected output file paths"
    },
    "nonce": {
      "type": "integer",
      "default": 0,
      "description": "Arbitrary value to force re-execution"
    },
    "timeout_ms": {
      "type": "integer",
      "default": 5000,
      "minimum": 1,
      "description": "Maximum execution time in milliseconds"
    },
    "max_output_bytes": {
      "type": "integer",
      "default": 4096,
      "description": "Maximum stdout/stderr capture size"
    },
    "policy": {
      "type": "object",
      "properties": {
        "deterministic": {
          "type": "boolean",
          "default": true
        },
        "allow_outside_workspace": {
          "type": "boolean",
          "default": false
        },
        "inherit_env": {
          "type": "boolean",
          "default": false
        },
        "mode": {
          "type": "string",
          "enum": ["strict", "permissive"],
          "default": "strict"
        },
        "time_mode": {
          "type": "string",
          "enum": ["fixed_zero", "wall_clock"],
          "default": "fixed_zero"
        },
        "scheduler_mode": {
          "type": "string",
          "enum": ["repro", "turbo"],
          "default": "turbo"
        },
        "env_allowlist": {
          "type": "array",
          "items": {"type": "string"}
        },
        "env_denylist": {
          "type": "array",
          "items": {"type": "string"},
          "default": ["RANDOM", "TZ", "HOSTNAME", "PWD", "OLDPWD", "SHLVL"]
        },
        "required_env": {
          "type": "object",
          "additionalProperties": {"type": "string"},
          "default": {"PYTHONHASHSEED": "0"}
        },
        "enforce_sandbox": {
          "type": "boolean",
          "default": true,
          "description": "If false, sandbox confinement will not be enforced"
        },
        "max_memory_bytes": {
          "type": "integer",
          "default": 0,
          "description": "Maximum memory for the process in bytes (0 = unlimited)"
        },
        "max_file_descriptors": {
          "type": "integer",
          "default": 0,
          "description": "Maximum number of open file descriptors (0 = unlimited)"
        }
      }
    },
    "llm": {
      "type": "object",
      "properties": {
        "mode": {
          "type": "string",
          "enum": ["none", "subprocess", "sidecar", "freeze_then_compute", "attempt_deterministic"],
          "default": "none"
        },
        "runner_argv": {
          "type": "array",
          "items": {"type": "string"}
        },
        "model_ref": {
          "type": "string"
        },
        "seed": {
          "type": "integer"
        },
        "sampler": {
          "type": "object"
        },
        "include_in_digest": {
          "type": "boolean",
          "default": false
        },
        "determinism_confidence": {
          "type": "number",
          "description": "Confidence threshold for 'attempt_deterministic' mode"
        }
      }
    },
    "tenant_id": {
      "type": "string",
      "description": "Multi-tenant isolation identifier"
    }
  }
}
```

### Example Request

```json
{
  "request_id": "build-abc-123",
  "command": "/usr/bin/gcc",
  "argv": ["-c", "main.c", "-o", "main.o"],
  "env": {"PATH": "/usr/bin"},
  "cwd": "src",
  "workspace_root": "/tmp/build",
  "inputs": {"main.c": "abc123..."},
  "outputs": ["main.o"],
  "timeout_ms": 30000,
  "policy": {
    "mode": "strict",
    "scheduler_mode": "repro",
    "env_allowlist": ["PATH"]
  }
}
```

## Execution Result

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["ok", "exit_code"],
  "properties": {
    "ok": {
      "type": "boolean",
      "description": "True if exit_code is 0 and no error"
    },
    "exit_code": {
      "type": "integer",
      "description": "Process exit code (124 = timeout)"
    },
    "error_code": {
      "type": "string",
      "description": "Requiem error code if applicable"
    },
    "termination_reason": {
      "type": "string",
      "enum": ["", "timeout", "error"]
    },
    "stdout_truncated": {
      "type": "boolean"
    },
    "stderr_truncated": {
      "type": "boolean"
    },
    "stdout": {
      "type": "string",
      "description": "Captured stdout (possibly truncated)"
    },
    "stderr": {
      "type": "string",
      "description": "Captured stderr (possibly truncated)"
    },
    "request_digest": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$",
      "description": "BLAKE3 hex digest of canonical request"
    },
    "trace_digest": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$"
    },
    "stdout_digest": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$"
    },
    "stderr_digest": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$"
    },
    "result_digest": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$",
      "description": "BLAKE3 hex digest of canonical result"
    },
    "output_digests": {
      "type": "object",
      "additionalProperties": {
        "type": "string",
        "pattern": "^[a-f0-9]{64}$"
      }
    },
    "trace_events": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "seq": {"type": "integer"},
          "t_ns": {"type": "integer"},
          "type": {"type": "string"},
          "data": {"type": "object"}
        }
      }
    },
    "policy_applied": {
      "type": "object",
      "properties": {
        "mode": {"type": "string"},
        "time_mode": {"type": "string"},
        "allowed_keys": {
          "type": "array",
          "items": {"type": "string"}
        },
        "denied_keys": {
          "type": "array",
          "items": {"type": "string"}
        },
        "injected_required_keys": {
          "type": "array",
          "items": {"type": "string"}
        }
      }
    },
    "sandbox_applied": {
      "type": "object",
      "properties": {
        "workspace_confinement": {"type": "boolean"},
        "rlimits": {"type": "boolean"},
        "seccomp": {"type": "boolean"},
        "job_object": {"type": "boolean"},
        "restricted_token": {"type": "boolean"},
        "enforced": {
          "type": "array",
          "items": {"type": "string"}
        },
        "unsupported": {
          "type": "array",
          "items": {"type": "string"}
        }
      }
    },
    "sandbox_applied": {
      "type": "object",
      "properties": {
        "workspace_confinement": {"type": "boolean"},
        "rlimits": {"type": "boolean"},
        "seccomp": {"type": "boolean"},
        "job_object": {"type": "boolean"},
        "restricted_token": {"type": "boolean"},
        "enforced": {
          "type": "array",
          "items": {"type": "string"}
        },
        "unsupported": {
          "type": "array",
          "items": {"type": "string"}
        }
      }
    },
    "signature": {
      "type": "string",
      "description": "Signed result envelope (Enterprise)"
    },
    "audit_log_id": {
      "type": "string",
      "description": "Audit log correlation ID (Enterprise)"
    }
  }
}
```

### Example Result

```json
{
  "ok": true,
  "exit_code": 0,
  "error_code": "",
  "termination_reason": "",
  "stdout_truncated": false,
  "stderr_truncated": false,
  "stdout": "Build successful\n",
  "stderr": "",
  "request_digest": "a1b2c3d4...",
  "trace_digest": "e5f6a7b8...",
  "stdout_digest": "c9d0e1f2...",
  "stderr_digest": "a3b4c5d6...",
  "result_digest": "f7a8b9c0...",
  "output_digests": {
    "main.o": "d1e2f3a4..."
  },
  "trace_events": [
    {"seq": 1, "t_ns": 0, "type": "process_start", "data": {"command": "/usr/bin/gcc"}},
    {"seq": 2, "t_ns": 1500000, "type": "process_end", "data": {"exit_code": "0"}}
  ],
  "policy_applied": {
    "mode": "strict",
    "time_mode": "fixed_zero",
    "allowed_keys": ["PATH"],
    "denied_keys": [],
    "injected_required_keys": ["PYTHONHASHSEED"]
  },
  "sandbox_applied": {
    "workspace_confinement": true,
    "rlimits": true,
    "seccomp": false,
    "job_object": false,
    "restricted_token": false,
    "enforced": ["workspace_confinement", "rlimits"],
    "unsupported": ["seccomp", "job_object", "restricted_token"]
  }
}
```

## Error Codes

| Code | Description | HTTP Equivalent |
|------|-------------|-----------------|
| `json_parse_error` | Invalid JSON syntax | 400 |
| `json_duplicate_key` | Duplicate keys in JSON object | 400 |
| `path_escape` | Path escapes workspace root | 403 |
| `missing_input` | Required input missing | 400 |
| `spawn_failed` | Process spawn failed | 500 |
| `timeout` | Execution exceeded timeout | 504 |
| `cas_integrity_failed` | CAS object corrupted | 500 |
| `replay_failed` | Replay validation failed | 409 |
| `drift_detected` | Non-deterministic behavior detected | 409 |
| `hash_unavailable_blake3` | BLAKE3 not available | 503 |
| `sandbox_unavailable` | Sandbox enforcement unavailable | 503 |
| `quota_exceeded` | Tenant quota exceeded | 429 |

## Hash Algorithms

### BLAKE3 (Primary)

- Output: 32 bytes (256 bits)
- Hex encoding: 64 characters lowercase
- Domain separation prefixes:
  - `"req:"` - Request canonicalization
  - `"res:"` - Result canonicalization
  - `"cas:"` - CAS content

### Canonical JSON

For hashing, JSON is canonicalized:

1. Object keys sorted lexicographically
2. No insignificant whitespace
3. No duplicate keys (rejected with `json_duplicate_key` error)
4. Numbers: integers as integers, floats with 6 decimal places (e.g., `1.5`, `2.000000`)
5. Scientific notation preserved when parsed
6. Negative numbers supported
7. No escaped Unicode in strings (UTF-8 encoded)
8. Escape sequences: `\n`, `\t`, `\r`, `\b`, `\f`, `\"`, `\\`

### JSON Limitations

The parser has these intentional limitations:

- Numbers outside uint64 range are stored as double
- NaN and Infinity are rejected (use null instead)
- No explicit null type in extractors (returns default)

### Known Vectors

| Input | BLAKE3 Hash |
|-------|-------------|
| `""` (empty) | `af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262` |
| `"hello"` | `ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f` |

## CLI Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Validation/blocker error |
| 124 | Timeout (process exit code) |
| 128+N | Fatal signal N |

## Version Compatibility

### v1.0 (Current)

- Hash: BLAKE3 only (vendored)
- CAS: v2 with zstd
- ABI: v1

### Migration from v0.x

1. Run `requiem migrate cas` to rehash with BLAKE3
2. Verify with `requiem validate-replacement`
3. No silent mixing of hash primitives allowed
