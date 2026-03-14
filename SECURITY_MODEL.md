# Security Model (Canonical Entry)

Canonical security reference lives in `SECURITY.md` and `docs/MCP_SECURITY_REVIEW.md`.

Security guarantees are executable via:

- `pnpm run verify:no-stack-leaks`
- `pnpm run verify:nosecrets`
- `pnpm run verify:tenant-isolation`
- `pnpm --filter ready-layer test -- auth-enforcement tenant-isolation-api`
