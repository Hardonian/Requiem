# Testing Strategy

- Unit: isolated package tests in packages/*/tests.
- Integration: route/auth/validation tests in ready-layer/tests.
- Smoke: scripts/verify-routes-runtime.ts.
- Light load: burst check in scripts/verify-routes-runtime.ts for /api/runs.

Added in this pass:
- ready-layer/tests/openapi-route-parity.test.ts
