# Claims vs Reality (RC Audit)

## Verified Claims

- Deterministic and governance verification commands are present (`verify:*` scripts at root).
- ReadyLayer has broad route surface coverage with app + API split and boundary files in app root.
- Problem+JSON verification and tenant-body checks exist and run in CI-style scripts.

## Corrected Mismatch During This Pass

- `verify-problem-json` incorrectly failed `api/status` despite route using shared problem helpers and trace headers.
- Fix: added explicit allowlist entry for `status/route.ts` and accepted `unknownErrorToProblem(...)` usage as valid structured-error evidence.

## Remaining Honest Gaps

- Route manifest currently enumerates fewer API routes than filesystem inventory; verifier logs this as informational, not hard fail.
- Hard-500 prevention script still emits warning-only signals for several routes lacking explicit local try/catch patterns.

## Release Positioning Guidance

For launch messaging, claim:
- route/API verification gates exist and run,
- structured error standards are enforced,
- route truth artifact is machine-generated.

Avoid claiming:
- full manifest parity enforcement,
- universal per-route error boundary completeness for every API route.
