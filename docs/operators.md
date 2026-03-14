# Operator Workflows

Primary operator interfaces:

- CLI: `packages/cli/src/cli.ts`
- Web console: `ready-layer/src/app/console/`
- Health/diagnostics APIs: `ready-layer/src/app/api/health/route.ts`, `ready-layer/src/app/api/status/route.ts`

Recommended first-run flow:

1. `pnpm install --frozen-lockfile`
2. `pnpm doctor`
3. `pnpm dev`
4. `pnpm verify:repo`

Operational commands:

- `requiem status` — health and enforcement snapshot.
- `requiem doctor` — local diagnostics for runtime readiness.
- `requiem inspect <artifact>` — inspect deterministic artifacts and traces.
- `requiem repair <run_id> [--apply]` — preview/apply safe repairs.
- `requiem proof:inspect <proofpack>` — required-field and hash inspection.
- `requiem security:scan [--sbom <path>]` — SBOM + denylist scan.
