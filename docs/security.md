# Security

Security posture is bounded by what is implemented and verifiable in this repository.

## Baseline checks

```bash
pnpm verify:nosecrets
pnpm verify:ai-safety
pnpm verify:tenant-isolation
pnpm verify:deploy-readiness
```

## Security expectations

- Degraded security state should be explicit in command output.
- Verification commands should fail closed where checks cannot be established.
- Multi-tenant boundaries must be tested; no cross-tenant assumptions by default.

## Not claimed here

- No claim of external certification or third-party audit by default.
- No claim that local checks alone provide complete production security proof.

See also: root `SECURITY.md` for vulnerability reporting process.
