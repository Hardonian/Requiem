# Release Checklist

This checklist is for releases that need honest operator-facing claims.

## 1. Repo and toolchain baseline

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm run doctor`
- [ ] `pnpm run verify:deploy-readiness
pnpm run verify:release`

## 2. Code verification

- [ ] `pnpm run route:inventory`
- [ ] `pnpm run verify:routes`
- [ ] `pnpm run lint`
- [ ] `pnpm run typecheck`
- [ ] `pnpm run build`
- [ ] `pnpm run test`

## 3. Security and trust surface

- [ ] `pnpm run verify:tenant-isolation`
- [ ] `pnpm run verify:nosecrets`
- [ ] `pnpm run verify:no-stack-leaks`

## 4. Optional deeper evidence

- [ ] `pnpm run verify:determinism`
- [ ] `pnpm run verify:replay`

## 5. Documentation truth gate

- [ ] README commands exist and match current scripts.
- [ ] [ENVIRONMENT.md](./ENVIRONMENT.md) matches current env examples.
- [ ] [DEPLOYMENT.md](./DEPLOYMENT.md) still matches supported topology truth.
- [ ] Tenancy language does not imply org/team SaaS unless code now proves it.
- [ ] Stub/demo/informational routes are not described as live runtime proof.

## 6. Deployment honesty gate

- [ ] No deployment guide recommends `REQUIEM_ALLOW_INSECURE_DEV_AUTH=1` outside local dev.
- [ ] No doc claims horizontal safety while request guards remain single-process.
- [ ] No doc markets `/app/tenants` as live shared-tenant administration.

## 7. Release notes / reviewer bundle

- [ ] Record exact commit SHA.
- [ ] Record commands run and pass/fail status.
- [ ] Record any intentional degraded or unsupported areas.
