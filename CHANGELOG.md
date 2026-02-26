# Changelog

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
