# Launch Checklist

## Pre-launch

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] `pnpm test`
- [ ] `pnpm verify:demo`
- [ ] `pnpm verify:determinism`
- [ ] `pnpm verify:replay`
- [ ] `pnpm evidence`
- [ ] `pnpm verify:deploy-readiness`
- [ ] Validate optional-service degraded paths are explicit in output/docs

## Launch day

- [ ] Publish README + docs links first
- [ ] Run `pnpm doctor` and `pnpm verify:demo` on launch commit
- [ ] Verify primary UI route and core CLI commands
- [ ] Monitor issue tracker and triage within first hour
- [ ] Keep rollback commit/tag ready

## Post-launch (first 72h)

- [ ] Tag incoming bugs with reproducibility info
- [ ] Update `docs/known-issues.md` for confirmed issues
- [ ] Re-run benchmark/evidence commands and compare drift
- [ ] Patch quickstart docs if real user confusion appears
