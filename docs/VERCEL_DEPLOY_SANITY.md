# Vercel Deploy Sanity (ReadyLayer)

## Required project settings

- **Root Directory:** `ready-layer`
- **Framework Preset:** Next.js
- **Install Command:** `pnpm install --frozen-lockfile`
- **Build Command:** `pnpm --filter ready-layer build`

If Vercel is configured at repository root instead of `ready-layer`, deployment may resolve to an app without `app/` routes and yield `/` failures.

## Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `REQUIEM_API_URL`
- Optional diagnostics: `VERCEL_GIT_COMMIT_SHA`, `BUILD_TIME`, `REQUIEM_PROMPT_VERSION`, `REQUIEM_CORE_VERSION`

## Common failure modes

1. **`/` returns 404:** wrong root directory or build command not scoped to `ready-layer`.
2. **Auth redirects fail:** `/auth/signin` missing or middleware points to a route that does not exist.
3. **API hard failures:** missing auth env; middleware will return Problem+JSON instead of hard 500.
4. **Stale prompt claims:** UI should read from `/api/status` instead of hardcoded prompt/version text.
