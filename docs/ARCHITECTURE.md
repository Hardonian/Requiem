# Architecture Notes

- Deterministic mode forces trace `t_ns=0`.
- Workspace confinement normalizes cwd/outputs under `workspace_root` unless explicit policy allow flag is true.
- Windows runner uses `CreateProcessW` + pipes + Job Object kill-tree.
- POSIX runner uses process-group kill for timeout parity (exit sentinel `124`).
- Strict JSON parser rejects duplicate keys and NaN/Infinity.
- Canonical JSON serializer uses lexicographic object key ordering for stable hashing.
- Drift analyzer emits structured mismatch records for control-plane ingestion.
