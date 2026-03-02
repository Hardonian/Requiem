# BASELINE.md — Phase 0 Discovery Report

> Generated: 2026-03-02  
> Agent: Opus 4.6 (Antigravity)  
> Commit: discovery, pre-kernel-lock

---

## 1. Repository Structure

```
Requiem/
├── CMakeLists.txt          # C++20 engine build (cmake 3.20+)
├── package.json            # pnpm monorepo root (Node ≥20.11)
├── pnpm-workspace.yaml     # workspaces: packages/*, ready-layer
├── include/requiem/        # 25 public headers
├── src/                    # 38 C++ source files (engine + CLI + harnesses)
├── tests/
│   ├── requiem_tests.cpp   # 2624-line monolithic test file
│   ├── fixtures/
│   └── invariants/         # TS invariant checks
├── third_party/blake3/     # Vendored BLAKE3 C implementation
├── packages/
│   ├── ai/                 # @requiem/ai — AI orchestration
│   ├── cli/                # @requiem/cli — TypeScript CLI ("reach")
│   └── ui/                 # @requiem/ui — design system primitives
├── ready-layer/            # Next.js web UI
├── docs/                   # 75 documentation files
├── scripts/                # 84 verification, CI, and tooling scripts
├── contracts/              # 8 contract definition files
├── formal/                 # 10 formal specification files
└── build/                  # CMake build output (currently empty — no .exe found)
```

## 2. Hashing / Serialization

### Hash Primitive

- **Algorithm**: BLAKE3-256, vendored C implementation (`third_party/blake3/`)
- **Output**: 32 bytes raw → 64 hex chars
- **No fallback**: `set_hash_fallback_allowed()` is a permanent no-op
- **Version**: `HashEnvelope.hash_version = 1`, `HASH_ALGORITHM_VERSION = 1`

### Domain Separation

Implemented in `src/hash.cpp`:

- `"req:"` prefix → `canonical_json_hash()` — request canonicalization
- `"res:"` prefix → `result_json_hash()` — result canonicalization
- `"cas:"` prefix → `cas_content_hash()` — CAS object content
- `deterministic_digest()` → raw `blake3_hex()` (no domain prefix)

### Canonical Encoding

- Requests: `canonicalize_request()` → `jsonlite::to_json()` using `std::map` (sorted keys)
- Results: `canonicalize_result()` → same jsonlite path
- JSON library: custom `jsonlite` (in-tree), no third-party JSON dependency
- Locale-invariant: explicit implementation avoids `std::ostringstream` locale dependency
- Nonce: stored as `uint64_t`, serialized as integer (not float)

### HashEnvelope

```cpp
struct HashEnvelope {
    uint32_t hash_version{1};
    char     algorithm[16]{"blake3"};
    char     engine_version[32]{};
    uint8_t  payload_hash[32]{};
};
```

Fixed-size, C ABI safe. Round-trip via `hash_envelope_from_hex()`/`hash_envelope_to_hex()`.

## 3. Persistence

### Content-Addressable Storage (CAS)

- **Class**: `CasStore` with `ICASBackend` interface
- **Default root**: `.requiem/cas/v2`
- **Sharding**: `AB/CD/<64-char-digest>` directory layout
- **Format version**: `CAS_FORMAT_VERSION = 2`
- **Integrity**: content hash verification on `get()` — returns `nullopt` on mismatch
- **Index**: `index.ndjson` append-only with `compact()` method
- **Compression**: optional zstd (`REQUIEM_WITH_ZSTD`)
- **Dedup**: automatic via content addressing
- **Backends**: `LocalFSBackend` (default), `S3CompatibleBackend` (stub), `ReplicatingBackend` (dual-write)
- **Atomic writes**: temp file + rename pattern

### Audit Log

- **Class**: `ImmutableAuditLog`
- **Format**: NDJSON, one `ProvenanceRecord` per line
- **Chaining**: each record contains `previous_digest` (BLAKE3 of previous entry JSON)
- **Monotonic**: sequence numbers never reused
- **Singleton**: `global_audit_log()` with env var or programmatic configuration
- **Version**: `AUDIT_LOG_VERSION = 1`
- **Fields**: sequence, prev_digest, execution_id, tenant_id, request_digest, result_digest, engine_semver, engine_abi_version, hash_algorithm_version, cas_format_version, replay_verified, ok, error_code, duration_ns, timestamp_unix_ms, worker_id, node_id

## 4. Logging / Observability

- **EngineStats**: atomic counters for total/successful/failed executions, latency percentiles
- **ExecutionEvent**: per-execution structured event emitted to `emit_execution_event()`
- **MeterLog**: thread-safe billing event log with shadow-exclusion invariant
- **Trace events**: in-memory per-execution, sequential numbering, arena-allocated (PMR)

## 5. CLI Command Registry

### C++ Native CLI (`requiem_cli` → `requiem` binary)

Located in `src/cli.cpp` (1534 lines). Entry point: `main()` with string-match dispatch.

**Registered commands (C++ native)**:

| Command                | Description                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `help` / `--help`      | Usage text                                                                           |
| `version`              | Engine + protocol versions                                                           |
| `health`               | Hash primitive + CAS + compression capabilities                                      |
| `doctor`               | Platform capability checks, sandbox, cluster drift                                   |
| `doctor --analyze`     | AI-assisted root cause diagnostics                                                   |
| `validate-replacement` | Hash certification gates                                                             |
| `exec run`             | Execute request deterministically                                                    |
| `exec stream`          | NDJSON streaming execution                                                           |
| `exec replay`          | Verify execution against stored result                                               |
| `cas put`              | Store content in CAS                                                                 |
| `cas info`             | Query CAS object metadata                                                            |
| `cas gc`               | Dry-run garbage collection scan                                                      |
| `cas verify`           | Verify all CAS object integrity                                                      |
| `digest verify`        | Verify a result digest                                                               |
| `digest file`          | Compute BLAKE3 of a file                                                             |
| `policy check`         | Check request against policy                                                         |
| `policy explain`       | Explain active policy settings                                                       |
| `llm explain`          | Explain LLM integration modes                                                        |
| `lint`                 | Policy linter                                                                        |
| `bench run`            | Run benchmark suite                                                                  |
| `bench compare`        | Compare benchmark results                                                            |
| `drift analyze`        | Analyze digest drift                                                                 |
| `drift pretty`         | Pretty-print drift results                                                           |
| `cluster status`       | Show cluster health                                                                  |
| `cluster workers`      | List registered workers                                                              |
| `cluster shard`        | Shard lookup for tenant                                                              |
| `cluster join`         | Register local worker                                                                |
| `cluster verify`       | Verify cluster consistency                                                           |
| Harnesses              | `stress`, `shadow`, `billing`, `security`, `recovery`, `memory`, `protocol`, `chaos` |

### TypeScript CLI (`packages/cli/src/cli.ts` → "reach")

Available via `pnpm reach`. Contains 46 command files in `packages/cli/src/commands/`.

## 6. Web APIs

### ReadyLayer (`ready-layer/`)

- **Framework**: Next.js 16 (App Router)
- **Structure**: `ready-layer/src/app/` with route handlers
- **Key routes**: TBD (documented in `routes.manifest.json`)
- **Build**: `pnpm build:web` → Next.js production build

## 7. Version Manifest

```cpp
constexpr uint32_t ENGINE_ABI_VERSION = 2;
constexpr uint32_t HASH_ALGORITHM_VERSION = 1;
constexpr uint32_t CAS_FORMAT_VERSION = 2;
constexpr uint32_t PROTOCOL_FRAMING_VERSION = 1;
constexpr uint32_t REPLAY_LOG_VERSION = 1;
constexpr uint32_t AUDIT_LOG_VERSION = 1;
```

Engine semver: `1.3.0` (from CMakeLists.txt `project(requiem VERSION 1.3.0)`)

## 8. Build & Test Baseline

### Engine Build

```bash
# CMake configure + build
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j
```

**Requirements**: CMake 3.20+, C++20 compiler, OpenSSL, zstd, vendored BLAKE3
**Status**: No build artifacts found in `build/` directory. Build requires Visual Studio Build Tools + vcpkg (per conversation history).

### Tests

```bash
# C++ tests
ctest --test-dir build --output-on-failure
```

**Test file**: `tests/requiem_tests.cpp` (2624 lines)
**Test coverage**: hash vectors, canonicalization, domain separation, CAS put/get/integrity, replay validation, metering, concurrency, multi-tenant isolation, HashEnvelope, observability

### CLI Smoke

```bash
# Native CLI (after build)
./build/requiem doctor
./build/requiem health
./build/requiem version

# TypeScript CLI
pnpm reach
```

### Web Build

```bash
pnpm build:web
```

**Status**: ReadyLayer is present. Build requires `pnpm install` first.

## 9. Existing Primitives Assessment

| Kernel Primitive                  | Exists?    | Status                                                      | Location                    |
| --------------------------------- | ---------- | ----------------------------------------------------------- | --------------------------- |
| Canonical encoding                | ✅ Yes     | jsonlite sorted-key JSON                                    | `src/runtime.cpp`           |
| Hash + domain sep                 | ✅ Yes     | BLAKE3 + req:/res:/cas:                                     | `src/hash.cpp`              |
| Versioned envelope                | ✅ Partial | HashEnvelope exists, no full envelope wrapping all messages | `include/requiem/types.hpp` |
| Event log (append-only)           | ✅ Yes     | ImmutableAuditLog with Merkle chaining                      | `src/audit.cpp`             |
| CAS (put/get/verify)              | ✅ Yes     | Full LocalFS backend                                        | `src/cas.cpp`               |
| Capabilities (mint/verify/revoke) | ❌ No      | Not implemented                                             | —                           |
| Policy VM (deterministic eval)    | ❌ No      | Policy linter exists, no eval VM                            | `src/policy_linter.cpp`     |
| Metering (charge/deny)            | ✅ Partial | MeterLog exists, no hard budget denial                      | `src/metering.cpp`          |
| Plan Graph (DAG scheduling)       | ❌ No      | Not implemented                                             | —                           |
| Receipts (signed proofs)          | ✅ Partial | ProofBundle exists, no signing                              | `include/requiem/types.hpp` |
| Replay verification               | ✅ Yes     | validate_replay + validate_replay_with_cas                  | `src/replay.cpp`            |

## 10. Gap Analysis for Kernel Spec

**Must build**:

1. **Capability tokens** — ed25519 mint/verify/revoke with fingerprint storage
2. **Policy VM** — deterministic eval with proof hash, input/output in CAS
3. **Plan Graph** — DAG schema + deterministic scheduler
4. **Budget denial** — hard limit in metering with denial semantics
5. **Receipt signing** — ed25519 signatures on ProofBundle/ProvenanceRecord
6. **Log verification** — CLI command to verify full audit chain

**Must extend**:

1. **Versioned envelope** — wrap all CLI + API responses in typed envelope
2. **Metering** — add budget model with receipt schema
3. **ProofBundle** — add signing, anchor in event log

**Existing foundations are solid**: BLAKE3, CAS, audit log, canonicalization, replay. The kernel spec should build on these rather than replacing them.
