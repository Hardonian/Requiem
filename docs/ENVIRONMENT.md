# Environment Contract

This document is the authoritative environment/config reference for this repository.

If a variable is not listed here, do not assume it is part of the supported operator contract.

## Scope

There are two practical env scopes in this repo:

1. **root/local repo workflows** — install, build, CLI, local verification,
2. **`ready-layer/` deployment/runtime** — Next.js app, middleware, auth, API routes, Prisma tasks.

## Deployment modes

| Mode | Description | Required baseline |
| --- | --- | --- |
| Local CLI only | Use CLI and engine without ReadyLayer auth UI | Usually none beyond toolchain; some commands need provider-specific vars |
| ReadyLayer local dev | Run `pnpm run dev` and sign-in pages locally | Supabase public envs |
| ReadyLayer authenticated deployment | Hosted/single-instance console with authenticated routes | Supabase public envs + `REQUIEM_AUTH_SECRET` |
| ReadyLayer + external runtime/API | Authenticated deployment where runtime-backed pages call an external API | Supabase public envs + `REQUIEM_AUTH_SECRET` + `REQUIEM_API_URL` |
| Prisma/DB workflows | `prisma validate`, generate, or migrations | `DATABASE_URL` and typically `DIRECT_DATABASE_URL` |

## Variables

### ReadyLayer auth and session wiring

| Variable | Required? | Modes | Security critical? | What it does | Failure mode if missing |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Required for authenticated ReadyLayer UI | ReadyLayer local dev, deployed ReadyLayer | Yes | Lets browser/server initialize Supabase auth client | Sign-in/sign-up forms cannot initialize; middleware cannot create Supabase client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required for authenticated ReadyLayer UI | ReadyLayer local dev, deployed ReadyLayer | Yes, but public-by-design | Public anon key for Supabase auth flows | Same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Only server-side features that explicitly use service-role access | Yes | Enables privileged Supabase server operations where implemented | Features depending on privileged Supabase access degrade or remain unavailable |

### ReadyLayer auth enforcement

| Variable | Required? | Modes | Security critical? | What it does | Failure mode if missing |
| --- | --- | --- | --- | --- | --- |
| `REQUIEM_AUTH_SECRET` | Required for deployed authenticated API usage | Staging, production, test, any strict-auth deployment | Yes | Bearer-token/shared-secret validation for route auth helpers and internal auth proof fallback | Protected routes fail closed in strict mode with `auth_secret_required` or related auth errors |
| `REQUIEM_AUTH_MODE` | Optional | Mostly local development | Yes | Overrides auth mode selection; `strict` forces fail-closed, `local-dev` allows development behavior | If unset, mode defaults by `NODE_ENV` (`production`/`staging`/`test` => strict) |
| `REQUIEM_ALLOW_INSECURE_DEV_AUTH` | Optional and **dev-only** | Local development only | Yes | Allows insecure local bearer-token fallback when not in strict mode | If unset or `0`, missing `REQUIEM_AUTH_SECRET` stays an error; if set in deployed env, that is operator error |

**Do not use `REQUIEM_ALLOW_INSECURE_DEV_AUTH=1` in a real deployment.**

### External runtime/API wiring

| Variable | Required? | Modes | Security critical? | What it does | Failure mode if missing |
| --- | --- | --- | --- | --- | --- |
| `REQUIEM_API_URL` | Required only for routes/features that call an external runtime/API | ReadyLayer + external runtime/API | Indirectly | Base URL for runtime-backed pages and engine-client calls | Runtime-backed pages show explicit unconfigured/degraded states; some APIs remain unavailable |

Important: `REQUIEM_API_URL` is **not** required for every ReadyLayer page. Some routes are local-only, informational, or stub-backed.

Important: `/api/readiness` is stricter than page boot. It treats external runtime reachability as part of full-runtime readiness, so it will remain `503` when `REQUIEM_API_URL` is absent even if console-only pages can still render honestly in a degraded state.

### Database / Prisma

| Variable | Required? | Modes | Security critical? | What it does | Failure mode if missing |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | Required for Prisma/database workflows | Prisma validate/generate/migrate; DB-backed routes that use DB config | Yes | Primary database connection string | Prisma commands and DB-backed features fail |
| `DIRECT_DATABASE_URL` | Required in CI and recommended for Prisma workflows that expect a direct connection | CI Prisma steps, some migration setups | Yes | Direct DB connection for Prisma workflows | CI/local Prisma flows fail when expected by scripts or environment |

### Metadata / diagnostics

| Variable | Required? | Modes | Security critical? | What it does | Failure mode if missing |
| --- | --- | --- | --- | --- | --- |
| `VERCEL_GIT_COMMIT_SHA` | Optional | Hosted builds | No | Exposes build SHA in runtime manifest/status | UI shows fallback/unknown metadata |
| `BUILD_TIME` | Optional | Hosted builds | No | Build timestamp metadata | Fallback timestamp is used |
| `REQUIEM_PROMPT_VERSION` | Optional | Hosted builds | No | Prompt/version metadata displayed by status surfaces | Fallback label is used |
| `REQUIEM_CORE_VERSION` | Optional | Hosted builds | No | Core/version metadata displayed by status surfaces | Fallback label is used |
| `NEXT_PUBLIC_APP_URL` | Optional | Local route probes or explicit public URL wiring | No | Public app base URL used by some route/live-probe helpers | Live route probe scripts skip network checks |

## Variables that are easy to misuse

### `REQUIEM_ALLOW_INSECURE_DEV_AUTH`

- Purpose: local-only convenience for development.
- Safe use: only with `REQUIEM_AUTH_MODE=local-dev` on a developer machine.
- Unsafe use: any shared, staging, preview, or production deployment.

### `REQUIEM_API_URL`

- It does **not** turn the whole console into a complete production control plane.
- It only wires routes that explicitly depend on an external API/runtime.
- Routes that use local filesystem/single-process control-plane state remain local in behavior even when this variable is set.

### `SUPABASE_SERVICE_ROLE_KEY`

- Do not put this in browser-exposed config.
- Do not use it unless the specific server-side feature actually requires it.

## Variables removed from the operator contract

The previous root example contained variables that are not part of the current authoritative contract, including:

- `JWT_SECRET_KEY`
- `JWT_ALGORITHM`
- `REQUIEM_ENGINE_DUAL_RATE`
- `REQUIEM_DEFAULT_ENGINE`
- `REQUIEM_AUDIT_BACKEND`
- `REQUIEM_PROMPT_FILTER`
- `REQUIEM_COST_SINK`
- `PROMETHEUS_ENABLED`
- `DATADOG_API_KEY`

Those names are no longer presented as operator-required repo truth because the current repo surface does not rely on them as the primary deployment contract.

## Safe local bootstrap

### ReadyLayer local dev

```bash
cp ready-layer/.env.example ready-layer/.env.local
pnpm install --frozen-lockfile
pnpm run dev
```

### Root local repo flow

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm run doctor
```

## Verification commands tied to this contract

```bash
pnpm run verify:deploy-readiness
pnpm run doctor
pnpm run verify:routes
```
