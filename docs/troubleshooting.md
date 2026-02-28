# Troubleshooting

Common issues and solutions for the Requiem ecosystem.

## Build Issues

### `pnpm install` fails

Ensure you're using Node.js 20+ and pnpm 8+:

```bash
node -v   # Should be v20.x or higher
pnpm -v   # Should be 8.x
```

### Next.js build fails with lint errors

Run lint separately to see the exact error:

```bash
cd ready-layer && npx eslint .
```

### C++ build fails

Ensure CMake 3.20+, a C++20 compiler, and OpenSSL are installed:

```bash
# Ubuntu/Debian
sudo apt-get install cmake g++ libssl-dev

# macOS
brew install cmake openssl
```

## Vercel Deployment

### Build command

The Vercel build is configured in `vercel.json`. The build command:

1. Builds `@requiem/ai` package first
2. Installs ready-layer dependencies
3. Runs `next build` in ready-layer

### Environment variables

Required for production deployment (see `ready-layer/.env.example`):

- `REQUIEM_AUTH_SECRET` — JWT/token validation secret
- `REQUIEM_API_URL` — Engine API endpoint
- `NEXT_PUBLIC_APP_URL` — Public app URL for CORS

Optional (for full functionality):

- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key

### Missing routes

If routes return 404 after deploy, verify the build output includes all
expected routes. Run locally:

```bash
cd ready-layer && npx next build
```

The build output lists all generated routes.

## CLI Issues

### `requiem doctor` reports failures

Run `requiem doctor --json` for machine-readable output. Common fixes:

- **Node version**: Upgrade to Node.js 20+
- **Missing env vars**: Set `REQUIEM_WORKSPACE_ROOT` and API keys
- **Tool registry**: Ensure the workspace is properly initialized

### Commands not found

If `requiem` or `reach` are not found after install:

```bash
cd packages/cli
pnpm run build
npx requiem help
```

## Getting Help

- File an issue: https://github.com/reachhq/requiem/issues
- Email support: support@readylayer.com
