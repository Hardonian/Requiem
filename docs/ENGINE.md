# Requiem Engine

## Overview

Requiem is a deterministic execution engine that provides cryptographically verified, reproducible command execution with content-addressable storage.

## Enforced Guarantees

1. **Single hash primitive**: BLAKE3 only. Vendored. No fallback. Fail-closed.
2. **Deterministic execution**: Same request → same result digest (verified by 200x repeat gate in CI).
3. **Atomic CAS writes**: All CAS operations use tmp+rename for crash safety.
4. **Path confinement**: All paths resolved via `weakly_canonical()` and checked against workspace root.
5. **Secret stripping**: Environment variables matching `*_TOKEN`, `*_SECRET`, `*_KEY`, `*_PASSWORD`, `*_CREDENTIAL`, `AUTH*`, `COOKIE*`, `REACH_ENCRYPTION_KEY` are unconditionally stripped from child processes.
6. **Request ID sanitization**: Only `[a-zA-Z0-9_-]` characters allowed in request IDs.
7. **Request size cap**: Payloads exceeding 1 MB are rejected.
8. **Output file cap**: Maximum 256 output files per request.
9. **Integrity verification**: CAS objects are verified on read (stored blob hash + original content hash).

## Build

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
ctest --test-dir build --output-on-failure
```

If zstd-dev is not available:
```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DREQUIEM_WITH_ZSTD=OFF
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `requiem health` | Report hash primitive, backend, version |
| `requiem doctor` | Full diagnostics: engine version, protocol, sandbox, rollback |
| `requiem validate-replacement` | Verify engine is suitable as Rust engine replacement |
| `requiem exec run --request R --out O` | Execute request |
| `requiem exec replay --request R --result O --cas C` | Replay validation |
| `requiem digest verify --result O` | Verify result digests |
| `requiem bench run --spec S --out O` | Run benchmark |
| `requiem drift analyze --bench B --out O` | Analyze drift |
| `requiem cas gc --cas C` | Garbage collect CAS |

## Rollback

Set `FORCE_RUST=1` in the environment to disable Requiem and fall back to the Rust engine.
