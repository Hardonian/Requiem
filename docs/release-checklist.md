# Release Checklist

## Build + parity gates

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] `pnpm test`
- [ ] `pnpm verify:deploy-readiness`
- [ ] CI `deploy-readiness` job green

## Config + env gates

- [ ] `ready-layer/.env.example` matches expected required variables
- [ ] Vercel project uses repository root config (`vercel.json`)
- [ ] Preview + production env values reviewed for required keys

## Smoke checks

- [ ] Web route `/` loads
- [ ] Health endpoint responds
- [ ] Primary API action returns non-500 response

## Release metadata

- [ ] Changelog updated
- [ ] Release notes drafted
- [ ] Rollback target identified
