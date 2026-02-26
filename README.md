# Requiem (rqr) — Deterministic Native Runtime

Requiem is a native C++ runtime scaffold for:
- deterministic hashing
- content-addressable storage (CAS)
- execution requests + structured results
- replay validation (anti-theatre)

It is designed to be driven by an external control plane (Node/Rust/web). The control plane remains the source of truth for policies/workflows. Requiem is the high-performance, correctness-first execution core.

## Build
```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
ctest --test-dir build --output-on-failure
```

## Project layout
- `include/requiem/*`: public headers
- `src/*`: runtime implementation
- `tests/requiem_tests.cpp`: deterministic behavior checks
