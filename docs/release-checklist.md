# Release Checklist

## Pre-release verification

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

## Documentation alignment

- [ ] README quickstart commands match actual scripts.
- [ ] `docs/quickstart.md` and `docs/first-10-minutes.md` are current.
- [ ] `docs/limitations.md` reflects known boundaries.
- [ ] `docs/known-issues.md` is updated.

## Launch publish sequence

1. Tag release commit.
2. Publish release notes + changelog update.
3. Publish launch post/social copy.
4. Run smoke tests on published commit.

## Rollback + hotfix

- [ ] Previous stable tag documented.
- [ ] Hotfix owner and triage channel assigned.
- [ ] Rollback command/process documented for operators.
