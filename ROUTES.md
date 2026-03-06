# Route Completeness Matrix

| Route | Type | Auth required | Data deps | Status | Owner file |
|---|---|---:|---|---|---|
| / | static | no | none | exists | `ready-layer/src/app/page.tsx` |
| /docs | static | no | none | exists | `ready-layer/src/app/docs/page.tsx` |
| /documentation | static redirect | no | none | exists | `ready-layer/src/app/documentation/page.tsx` |
| /pricing | static | no | none | exists | `ready-layer/src/app/pricing/page.tsx` |
| /login | redirect | no | auth routes | exists | `ready-layer/src/app/login/page.tsx` |
| /signup | redirect | no | auth routes | exists | `ready-layer/src/app/signup/page.tsx` |
| /auth/signin | static | no | supabase config | exists | `ready-layer/src/app/auth/signin/page.tsx` |
| /auth/signup | static | no | supabase config | exists | `ready-layer/src/app/auth/signup/page.tsx` |
| /app | redirect | session | app shell | exists | `ready-layer/src/app/app/page.tsx` |
| /console | redirect | session | console shell | exists | `ready-layer/src/app/console/page.tsx` |
| /runs | static | session | runs API | exists | `ready-layer/src/app/runs/page.tsx` |
| /receipts | static | session | n/a | missing (not currently in nav/docs) | n/a |
| /events | static | session | n/a | missing (not currently in nav/docs) | n/a |
| /prompts | static | session | n/a | missing (not currently in nav/docs) | n/a |
| /policies | static | session | n/a | missing (console route exists at `/console/policies`) | n/a |
| /tenants | static | session | n/a | missing (console route exists at `/app/tenants`) | n/a |
| /settings | static | session | settings API | exists | `ready-layer/src/app/settings/page.tsx` |
| /tokens | static | session | n/a | missing (not currently in nav/docs) | n/a |
| /integrations | static | session | n/a | missing (not currently in nav/docs) | n/a |
| /status | dynamic | no | `/api/status` | exists | `ready-layer/src/app/status/page.tsx` |
| /changelog | static | no | changelog file | exists | `ready-layer/src/app/changelog/page.tsx` |
| /privacy | static | no | none | exists | `ready-layer/src/app/privacy/page.tsx` |
| /terms | static | no | none | exists | `ready-layer/src/app/terms/page.tsx` |
| /404 (not-found) | boundary | no | none | exists | `ready-layer/src/app/not-found.tsx` |
| /error | boundary | no | none | exists | `ready-layer/src/app/error.tsx` |
| /api/health | api | no | engine health | exists | `ready-layer/src/app/api/health/route.ts` |
| /api/status | api | no | runtime manifest + health | exists | `ready-layer/src/app/api/status/route.ts` |
| /api/runs | api | yes | tenant + backend | exists | `ready-layer/src/app/api/runs/route.ts` |
| /api/policies | api | yes | tenant + backend | exists | `ready-layer/src/app/api/policies/route.ts` |
| /api/decisions | api | yes | tenant + backend | exists | `ready-layer/src/app/api/decisions/route.ts` |
| /api/spend | api | yes | tenant + backend | exists | `ready-layer/src/app/api/spend/route.ts` |
