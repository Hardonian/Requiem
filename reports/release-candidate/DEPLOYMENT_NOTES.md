# Deployment Notes (RC1)

## Build/Runtime Truth

- Web stack: Next.js app under `ready-layer`.
- Root scripts delegate lint/typecheck/build/verify into workspace packages.
- Route verification includes static checks plus runtime probe script.

## Required Operator Checks Before Prod Promote

- Confirm production environment variables required by ReadyLayer are present.
- Run `pnpm run verify:routes` against release commit before deployment.
- Regenerate route truth artifact when routes change:
  - `pnpm run verify:release-artifacts`

## Routing Safety

- Global app-level error and not-found files are present and validated by verifier.
- Route truth matrix now generated from filesystem to reduce docs-vs-runtime drift.

## Release Artifact Locations

- `reports/release-candidate/ROUTE_TRUTH_MATRIX.json`
- `reports/release-candidate/ROUTE_TRUTH_MATRIX.md`
- `reports/release-candidate/BRAND_AUDIT.md`
- `reports/release-candidate/CLAIMS_VS_REALITY.md`
- `reports/release-candidate/RELEASE_VERIFICATION.md`
- `reports/release-candidate/KNOWN_TRADEOFFS.md`
