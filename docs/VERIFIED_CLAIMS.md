# Verified Claims

| Claim | Source | Proof command | Test/Check |
| --- | --- | --- | --- |
| Protected routes fail closed when strict auth secret is missing. | `ready-layer/src/lib/auth.ts` | `pnpm --filter ready-layer test -- --run ready-layer/tests/auth-mode.test.ts` | `auth-mode.test.ts` |
| MCP degraded responses do not leak internal exception strings. | `ready-layer/src/app/api/mcp/**/route.ts` | `pnpm --filter ready-layer test -- --run ready-layer/tests/mcp-route-degraded.test.ts` | `mcp-route-degraded.test.ts` |
| Route manifest reflects filesystem route reality. | `scripts/lib/route-manifest.ts` + `routes.manifest.json` | `pnpm run verify:routes` | `scripts/verify-routes.ts` |
| Non-exempt API routes use shared tenant wrapper. | `scripts/verify-routes.ts` | `pnpm run verify:routes` | wrapper conformance gate |
