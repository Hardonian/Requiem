# Changelog

## v1.0
- Added real BLAKE3 backend wiring via LLVM C BLAKE3 API with runtime backend/version reporting.
- Added CI hash-backend gate scripts and workflow assertions on Linux/Windows runners.
- Added `requiem llm explain` and request contract fields for `scheduler_mode` and LLM mode/include controls.
- Tightened replacement hard-gates: `requiem validate-replacement` fails when primitive is not BLAKE3 or backend is fallback/unavailable.
- Added `requiem doctor` for fast blocker detection focused on hash primitive truth.

## v0.9
- Added hash runtime metadata plumbing (`hash_primitive`, `hash_backend`, `compat_warning`) and surfaced via `requiem health`.
- Added explicit hash fallback toggle (`--allow-hash-fallback`) with compatibility warning semantics.

## v0.8
- Added fail-closed behavior for digest generation when BLAKE3 is unavailable and fallback is not explicitly enabled.
- Added deterministic fallback behavior tests and known digest vectors for empty/hello/1MiB payloads.

## v0.7
- Added stricter runtime propagation for hash backend failures across execution and CAS operations.
- Added `hash_unavailable_blake3` as explicit deterministic error code.

## v0.6
- Added hash runtime contract primitives (`HashRuntimeInfo`, fallback control API) to support replacement-readiness validation.

## v0.5
- Added drift analyzer and drift pretty output for deterministic mismatch detection.
- Added benchmark quantiles (`p50/p95/p99`), throughput, and deterministic digest reporting.
- Added control-plane report command and structured error code surface.

## v0.4
- Added strict JSON validation (duplicate-key rejection, NaN/Infinity rejection).
- Added canonical JSON serializer and canonical JSON hash API.
- Added CAS v2 compression metadata (`identity`/`zstd`) with key invariance.

## v0.3
- Added Windows process runner using CreateProcessW + pipes + Job Object timeout kill-tree.
- Refined POSIX timeout parity with process-group kill semantics and exit sentinel `124`.
- Added first-class determinism policy explain/check CLI and policy_applied result fields.
