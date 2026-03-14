# Release Process

## 1) Pre-flight

1. Confirm branch is up to date with main.
2. Run clean-room checks:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm verify:deploy-readiness
```

3. Ensure CI `ci.yml` is green, including `deploy-readiness` job.

## 2) Candidate cut

1. Update changelog for release candidate scope.
2. Tag candidate (`vX.Y.Z-rc.N`).
3. Trigger release workflow (`.github/workflows/release.yml`) if required.

## 3) Deployment

1. Deploy preview first and run smoke tests:
   - root route (`/`)
   - health/status route(s)
   - key API call path
2. Promote to production only after preview smoke checks pass.

## 4) Post-deploy verification

1. Verify runtime health and logs.
2. Validate required env vars are set (against `ready-layer/.env.example`).
3. Confirm no elevated error rates.

## 5) Rollback

1. Revert Vercel deployment to prior known-good build.
2. Roll back git tag/release notes if release is withdrawn.
3. Open incident note with root cause + corrective action before next candidate.
