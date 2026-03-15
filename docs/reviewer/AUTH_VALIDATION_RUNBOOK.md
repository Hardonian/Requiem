# Authenticated Truth Validation Runbook

1. `cd ready-layer`
2. `pnpm run generate:auth-truth` (refresh route/action inventory docs).
3. `pnpm run lint`
4. `pnpm run type-check`
5. `pnpm run test`
6. `REQUIEM_ROUTE_VERIFY_MODE=1 pnpm run dev` and validate protected routes show synthetic-auth disclosure.
7. Leave `REQUIEM_API_URL` unset and check degraded backend-missing disclosures.
8. Set `REQUIEM_API_URL=http://127.0.0.1:65535` and verify backend-unreachable errors differ from backend-missing copy.
9. Disable verify mode and confirm protected pages redirect to `/auth/signin` when no Supabase session is present.

If a route/action cannot be proven at runtime locally, classify it as **source-inspected only** or **runtime-backed but not provable in this environment** instead of claiming success.
