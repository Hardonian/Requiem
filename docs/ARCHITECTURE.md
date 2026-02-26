# Architecture Notes

- Deterministic mode forces trace `t_ns=0`.
- Env values are not traced; only keyset digest is emitted.
- Workspace confinement normalizes cwd/outputs under `workspace_root` unless explicit policy allow flag is true.
- CAS layout uses `objects/aa/bb/<digest>` fanout with atomic temp-file rename write.
