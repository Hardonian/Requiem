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
