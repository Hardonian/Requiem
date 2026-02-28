# Launch Gate Checklist

Pre-release gate for ReadyLayer / Requiem. Run every item before tagging a release.

**Branch**: must be off `main` with all PRs merged
**Command**: `pnpm run verify:full` must exit 0

---

## 1. Code Quality

- [ ] **Lint passes** — `pnpm run verify:lint` exits 0 (0 errors)
- [ ] **TypeScript compiles** — `pnpm run verify:typecheck` exits 0 (no errors)
- [ ] **Import boundaries enforced** — `pnpm run verify:boundaries` exits 0 (no cross-layer violations)

## 2. Routes & API Safety

- [ ] **Route manifest current** — `routes.manifest.json` exists at repo root and matches filesystem routes; run `bash scripts/generate_routes_manifest.sh` to regenerate
- [ ] **Route verifier passes** — `pnpm run verify:routes` exits 0
- [ ] **No hard-500 routes** — all API routes have `try/catch` with graceful `NextResponse.json` fallbacks; run `bash scripts/verify-no-hard-500.sh`

## 3. Security

- [ ] **No secrets in repo** — `bash scripts/verify-secrets.sh` exits 0
- [ ] **`.gitignore` covers** `.env`, `.env.local`, `.next/`, `node_modules/`
- [ ] **`.env.example` documents** all required env vars with safe placeholder values

## 4. Build & Deployment

- [ ] **Web build passes** — `pnpm run build:web` exits 0 (all pages generated, no build errors)
- [ ] **Vercel config correct** — `vercel.json` has build command and output directory set; run `vercel build` to verify locally if Vercel CLI available
- [ ] **Node version pinned** — `.nvmrc` exists and matches `engines.node` in root `package.json` (currently `>=20.0.0`)

## 5. Branding & Copy

- [ ] **Product name correct** — all user-facing copy says "ReadyLayer" (not "Requiem"); repo name may be Requiem internally
- [ ] **Email addresses** use `@readylayer.com` (not `@requiem.ai` or similar)
- [ ] **OG/metadata URLs** point to `readylayer.com`

## 6. CLI Completeness

- [ ] **Documented commands implemented** — every command in `docs/cli.md` is wired in the CLI entry point
- [ ] **Stub commands labeled** — commands not yet implemented say "not yet available" in help output
- [ ] **No duplicate help sections** — CLI `--help` shows each section exactly once

## 7. Documentation

- [ ] **README.md** — accurate architecture diagram and project description; no stale references
- [ ] **`docs/cli.md`** — full CLI reference matches actual command set
- [ ] **`docs/enterprise.md`** — feature gates and OSS vs. Enterprise boundaries documented
- [ ] **`docs/troubleshooting.md`** — common issues and solutions present

## 8. CI / Reproducibility

- [ ] **CI uses pnpm with frozen lockfile** — `ready-layer-verify` job in `.github/workflows/ci.yml` uses `pnpm install --frozen-lockfile`
- [ ] **CI Node version pinned** — `actions/setup-node` uses `node-version: '20'` (or `.nvmrc`)
- [ ] **`verify:full` in CI** — lint + typecheck + boundaries + routes + build:web all run in `ready-layer-verify` job
- [ ] **AI layer unit tests pass (node:test)** — `ai-unit-tests` job in CI exits 0; covers determinism, adversarial policy, eval cases, and wrapper tests
- [ ] **Policy contract verification passes** — `bash scripts/verify_policy_contract.sh` exits 0 in CI `governance` job
- [ ] **Feature flag verification passes** — `bash scripts/verify_flags.sh` exits 0 in CI `governance` job
- [ ] **Golden corpus validation passes** — all three canon JSON files parse without error in `ai-unit-tests` job
- [ ] **Contract JSON validation passes** — all four contract JSON files parse without error in `ai-unit-tests` job
- [ ] **Theatre audit reviewed** — `docs/THEATRE_AUDIT.md` read and all theatre items acknowledged or resolved

## 9. Repo Hygiene

- [ ] **Root is clean** — no stale zips, generated reports, or temp files committed to root
- [ ] **`docs/internal/`** — internal audit reports and scratch notes stay here, not root
- [ ] **OSS/Cloud/Enterprise boundary** — no cross-imports between OSS core and cloud/enterprise packages; verified by `verify-ui-boundaries.mjs`

## 10. Final Sign-off

- [ ] All items above checked
- [ ] `pnpm run verify:full` exits 0 on a clean checkout
- [ ] `git status` shows no uncommitted changes
- [ ] Tag is annotated: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
- [ ] CHANGELOG.md updated with release notes
