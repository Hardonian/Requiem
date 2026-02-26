# Requiem Architecture

## Overview

Requiem is a deterministic execution engine designed for reproducible builds, test isolation, and cryptographic verification of computation. It provides:

1. **Deterministic Execution**: Same inputs always produce same outputs
2. **Content-Addressable Storage**: CAS for efficient storage and retrieval
3. **Replay Validation**: Verify executions match recorded traces
4. **Sandboxing**: Cross-platform process isolation

## Core Components

### 1. Hash Module (`hash.cpp`)

Uses vendored BLAKE3 for all cryptographic operations.

**Key Functions:**
- `blake3_hex(data)` - Compute hex-encoded BLAKE3 hash
- `hash_bytes_blake3(data)` - Compute binary BLAKE3 hash
- `hash_file_blake3(path)` - Hash file contents
- `hash_domain(prefix, data)` - Domain-separated hashing

**Domain Separation:**
- `"req:"` - Request canonicalization
- `"res:"` - Result canonicalization
- `"cas:"` - CAS content addressing

### 2. CAS Module (`cas.cpp`)

Content-addressable storage with integrity verification.

**Features:**
- Object storage by BLAKE3 digest
- Sharded directory structure (`/objects/AB/CD/ABCDEF...`)
- Metadata with encoding info
- zstd compression support
- Integrity verification on read

**Storage Format:**
```
.cas/
└── v2/
    └── objects/
        ├── AB/
        │   └── CD/
        │       ├── ABCDEF...      # Stored blob
        │       └── ABCDEF....meta # Metadata
```

### 3. Runtime Module (`runtime.cpp`)

Execution engine with policy enforcement.

**Process:**
1. Parse and validate request JSON
2. Canonicalize request for hashing
3. Apply execution policy (env filtering, workspace confinement)
4. Spawn sandboxed process
5. Capture stdout/stderr with limits
6. Hash outputs
7. Compute result digest

**Policy Enforcement:**
- Workspace path normalization and confinement
- Environment variable allowlist/denylist
- Timeout enforcement
- Output size limits

### 4. Sandbox Module (`sandbox_posix.cpp`, `sandbox_win.cpp`)

Platform-specific process isolation.

**Linux:**
- Process groups for signal management
- Timeout with SIGKILL
- Path-based workspace confinement

**Windows:**
- Job Objects for kill-on-close
- Timeout with TerminateJobObject
- Named pipe I/O

### 5. Replay Module (`replay.cpp`)

Validation of execution results.

**Checks:**
- Request digest matches
- Output digests match
- Trace events match
- CAS objects exist and are valid

## Data Flow

```
┌─────────────────┐
│  Request JSON   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Parse & Validate│────▶│ Canonical JSON  │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ Apply Policy    │     │ Request Digest  │
│ (env, paths)    │     │ (BLAKE3)        │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Sandbox Spawn   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Execute Process │
│ (with timeout)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Capture Outputs │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Hash Outputs    │────▶│ Output Digests  │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Build Result    │────▶│ Result Digest   │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Result JSON     │
└─────────────────┘
```

## Security Architecture

### Threat Model

**Trusted:**
- Requiem binary
- Vendored BLAKE3 implementation
- System libraries (OpenSSL for TLS only)

**Untrusted:**
- Executed commands
- Input data
- Environment variables
- Workspace contents

### Mitigations

1. **Hash Unavailability**: Fail-closed behavior, explicit fallback required
2. **Path Traversal**: Workspace confinement with canonicalization
3. **Resource Exhaustion**: Timeouts, memory limits, FD limits
4. **Environment Leakage**: Allowlist/denylist filtering
5. **Output Leakage**: Size limits, truncation indicators

## Scheduler Modes

### Repro Mode (`scheduler_mode: "repro"`)

- Single-worker execution
- Strict FIFO ordering
- Deterministic dispatch
- Use for: Reproducible builds, verification

### Turbo Mode (`scheduler_mode: "turbo"`)

- Worker pool for concurrent execution
- Performance optimized
- Same digest semantics
- Use for: Development, CI, load testing

## Multi-Tenancy

Enterprise features for shared deployments:

- `tenant_id` isolation
- Namespaced CAS (optional)
- Resource quotas:
  - `max_concurrent`
  - `max_output_bytes`
  - `max_cas_bytes`

## Plugin ABI (v1)

C ABI for extending Requiem:

```c
typedef struct {
    uint32_t version;
    const char* name;
} requiem_plugin_info_t;

typedef struct {
    int (*on_engine_start)(const requiem_context_t* ctx);
    int (*on_request_received)(const requiem_request_t* req);
    int (*on_policy_applied)(const requiem_policy_t* policy);
    int (*on_result_ready)(const requiem_result_t* result);
} requiem_plugin_hooks_t;
```

## Version Compatibility

| Version | Hash Primitive | CAS Version | ABI Version |
|---------|---------------|-------------|-------------|
| v1.0    | BLAKE3        | v2          | v1          |
| v0.9    | BLAKE3/fallback| v2         | v1          |
| v0.5    | BLAKE3/fallback| v2         | -           |
| v0.1    | SHA-256       | v1          | -           |

## Future Directions

1. **Seccomp**: Fine-grained syscall filtering on Linux
2. **Landlock**: Path-based sandboxing
3. **Namespaces**: PID/network isolation
4. **WebAssembly**: Deterministic execution environment
