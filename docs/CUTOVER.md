# Engine Cutover: Rust → Requiem (C++)

## Status

Phase: **Finalization**

## What Changed

### Hash Unification (Phase 1)
- Replaced corrupted vendored BLAKE3 with official BLAKE3 1.5.4 C implementation
- Removed OpenSSL fallback stub — BLAKE3 is the sole hash primitive
- `set_hash_fallback_allowed()` is now a no-op
- `hash_runtime_info()` unconditionally reports `blake3/vendored`
- Optimized `to_hex()` — replaced `std::ostringstream` with direct char table lookup
- Increased file hash buffer from 8KB to 64KB for better I/O throughput

### Security Hardening (Phase 4)
- **Secret env stripping**: `*_TOKEN`, `*_SECRET`, `*_KEY`, `*_PASSWORD`, `*_CREDENTIAL`, `AUTH*`, `COOKIE*`, `REACH_ENCRYPTION_KEY` are unconditionally stripped from child process environments
- **Request ID sanitization**: Only `[a-zA-Z0-9_-]` chars allowed — prevents path traversal via request_id
- **Path confinement fix**: `normalize_under()` now checks that path starts with base + `/` (not just prefix match, which could match `workspace_root_evil/`)
- **Output file type check**: Only regular files are hashed (skip directories, symlinks)
- **CAS digest validation**: Invalid digests (wrong length, non-hex chars) are rejected before any filesystem access
- **Atomic CAS writes**: All CAS writes use tmp+rename pattern for crash safety

### Resource Stability (Phase 5)
- **Request size cap**: Payloads exceeding 1 MB rejected with `quota_exceeded`
- **Output file cap**: Maximum 256 output files per request
- **FORCE_RUST=1**: Honored at CLI entrypoint — engine refuses to run (exit 3)

### Operator Clarity (Phase 8)
- `requiem doctor` now outputs: engine_version, protocol_version, hash_primitive, hash_backend, hash_version, sandbox capabilities, rollback instructions

### CI Gates (Phase 7)
- `verify_protocol.sh`: Validates health, doctor, validate-replacement outputs
- `verify_security.sh`: Tests path traversal, request_id sanitization, FORCE_RUST
- `verify_cas.sh`: End-to-end CAS verification
- `verify_determinism.sh`: 200x repeat fixture — fails on any digest divergence

### Build Fixes
- Fixed BLAKE3 portable-only compilation (disabled SIMD dispatch for missing intrinsics sources)
- Fixed `sandbox_posix.cpp` — `detect_platform_sandbox_capabilities()` was outside `requiem` namespace
- Fixed `cli.cpp` — missing `<cmath>` and `<cstdlib>` includes
- Fixed `cas.cpp` — zstd include/usage properly gated behind `REQUIEM_WITH_ZSTD`
- Fixed `verify.sh` — auto-detects zstd availability

## Rollback

Set `FORCE_RUST=1` in the environment before invoking `requiem`. The engine will refuse to run (exit code 3), allowing the caller to fall back to the Rust engine.

## Verification

```bash
./scripts/verify.sh              # build + 22 unit tests
./scripts/verify_hash_backend.sh # BLAKE3 vendored gate
./scripts/verify_protocol.sh     # health/doctor/validate
./scripts/verify_security.sh     # escape, traversal, FORCE_RUST
./scripts/verify_determinism.sh  # 200x repeat (fail on drift)
```
