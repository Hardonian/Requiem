# Remaining Non-Blockers

## 1) API error-handling heuristic warnings
`pnpm run verify:routes` reports warning-level findings that some API routes “may lack error handling.”

- Current state: verification still passes; warnings are heuristic and non-fatal.
- Why non-blocking now: no failing contract checks, no new regressions introduced by this pass.
- Follow-up: implement explicit problem+json wrappers per warned route group and convert warnings to enforced checks.

## 2) Manifest coverage breadth
Route manifest includes fewer entries than total filesystem API routes.

- Current state: validator reports this as informational and passes.
- Why non-blocking now: build/runtime route checks still pass.
- Follow-up: expand manifest coverage to all production-facing API routes.

## 3) Middleware auth redirect in local screenshot flow
Visiting some pages in dev without configured Supabase redirects to sign-in.

- Current state: graceful redirect, no 500.
- Why non-blocking now: expected under missing identity config.
- Follow-up: provide explicit “auth not configured” informational banner pre-redirect for demo mode (optional UX polish).
