# Troubleshooting

Common issues and solutions for the Requiem ecosystem.

---

## Top 10 Failure Modes

### 1. `reach doctor` reports "unhealthy" status

**Symptoms:**

```
Status: UNHEALTHY
✗ Storage Initialization    Failed to initialize storage
✗ Decision Engine           Unavailable: Native engine not found
```

**Solutions:**

1. Build the native engine: `pnpm run build:cpp`
2. Or use TypeScript fallback: `export FORCE_RUST=1`
3. Check Node version: `node -v` (requires 20+)

---

### 2. Dashboard shows "Engine Node Not Connected"

**Symptoms:** Yellow warning banner on all `/app/*` routes

**Solutions:**

```bash
# Create .env.local in ready-layer/
REQUIEM_API_URL=http://localhost:8080
NEXT_PUBLIC_REQUIEM_API_URL=http://localhost:8080
```

Restart the dev server after adding env vars.

---

### 3. better-sqlite3 bindings not found

**Symptoms:**

```
Error: Could not locate the bindings file
```

**Solutions:**

```bash
# Rebuild native modules
pnpm rebuild better-sqlite3

# Or skip native modules (development only)
export REQUIEM_SQLITE_MEMORY=1
```

---

### 4. CLI commands return "Unknown command"

**Symptoms:**

```
Error: Unknown command: <command>. Run "reach help" for usage.
```

**Solutions:**

1. Check CLI is built: `cd packages/cli && npm run build`
2. Verify installation: `reach --version`
3. Use `--json` flag for structured error output

---

### 5. TypeScript build errors in CLI

**Symptoms:**

```
src/commands/show.ts(23,13): error TS1110: Type expected.
```

**Solutions:**

```bash
# Run type check
cd packages/cli && npm run typecheck

# Fix is usually:
# - Ensure all imports have .js extensions
# - Check for syntax errors in type annotations
```

---

### 6. Next.js build fails with lint errors

**Symptoms:**

```
Parsing error: '}' expected
```

**Solutions:**

```bash
# Check specific file
cd ready-layer && npx eslint src/app/page.tsx

# Auto-fix where possible
cd ready-layer && npx eslint . --fix
```

---

### 7. Routes return 404 in production

**Symptoms:** Deployed app shows 404 for known routes

**Solutions:**

1. Check build output: `pnpm run build:web`
2. Verify routes in output: Look for `Route (app)` section
3. Check `vercel.json` configuration
4. Ensure `next.config.js` has proper `output` setting

---

### 8. Policy enforcement not working

**Symptoms:** Tools execute without policy checks

**Solutions:**

```bash
# Check policy mode
reach status --json | jq '.policy'

# Should show:
# { "enforced": true, "mode": "standard" }

# If not enforced, check config:
reach init --tenant=default
```

---

### 9. Replay verification fails

**Symptoms:**

```
Divergence detected between original and replay
```

**Solutions:**

1. Check for non-deterministic code in tools
2. Verify CAS storage is accessible
3. Ensure identical environment (Node version, env vars)
4. Run `reach doctor` to check CAS consistency

---

### 10. High latency or timeouts

**Symptoms:** Commands take >5 seconds to respond

**Solutions:**

```bash
# Run benchmark
reach bench

# Check system resources
reach doctor --json | jq '.checks[] | select(.name | contains("Runtime"))'

# Common fixes:
# - Use --minimal flag for faster output
# - Enable caching: export REQUIEM_CACHE=1
# - Check disk space for CAS directory
```

---

## Build Issues

### `pnpm install` fails

Ensure you're using Node.js 20+ and pnpm 8+:

```bash
node -v   # Should be v20.x or higher
pnpm -v   # Should be 8.x
```

### C++ build fails

Ensure CMake 3.20+, a C++20 compiler, and OpenSSL are installed:

```bash
# Ubuntu/Debian
sudo apt-get install cmake g++ libssl-dev

# macOS
brew install cmake openssl

# Windows (PowerShell)
winget install Kitware.CMake
```

---

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

---

## CLI Issues

### `reach doctor` reports failures

Run `reach doctor --json` for machine-readable output. Common fixes:

- **Node version**: Upgrade to Node.js 20+
- **Missing env vars**: Set `REQUIEM_WORKSPACE_ROOT` and API keys
- **Tool registry**: Ensure the workspace is properly initialized

### Commands not found

If `reach` or `requiem` are not found after install:

```bash
cd packages/cli
pnpm run build
npx requiem help
```

---

## Getting Help

- File an issue: <https://github.com/reachhq/requiem/issues>
- Email support: <support@readylayer.com>
- Run diagnostics: `reach bugreport`
