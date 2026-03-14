# Operator Runbook (Canonical Entry)

Canonical runbook lives in `runbooks/` and `docs/release-checklist.md`.

Minimum triage flow:

1. Check `/api/health` and `/api/status`.
2. Correlate failures with `x-trace-id` and `x-request-id` in API responses.
3. Run `pnpm doctor` and `pnpm run verify:routes`.
