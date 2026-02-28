# FIXLOG.md

## Phase 0: Repo Truth + Baseline

### System Info
- **Node:** v24.12.0
- **pnpm:** 8.15.0
- **git status:** On branch main. Your branch is up to date with 'origin/main'. Changes not staged for commit. Untracked files present.

### Repo Structure
- **CLI entrypoint:** `packages/cli/src/cli.ts`
- **Web routes:** `ready-layer/src/app/app` (Next.js App Router)
- **API routes:** `ready-layer/src/app/api` (Next.js App Router)
- **Server runtime:** Node.js (from Next.js)
- **Supabase usage:** Vector search in `ready-layer/src/lib/vector-search.ts` and auth in `ready-layer/src/middleware/proxy.ts`.

### Baseline Run Outputs
- **lint:** ✅ PASS (with warnings) in `packages/ui`. `eslint src` in `packages/ui` passed with a warning about an unsupported TypeScript version.
- **typecheck:** ✅ PASS in `packages/ui`. `tsc --noEmit` in `packages/ui` passed with no output.
- **test:** ⚪️ SKIPPED. `ctest` requires `cmake` which is not installed.
- **build:** ⚪️ SKIPPED. Requires `cmake` which is not installed.
- **verify scripts:** ⚪️ SKIPPED. `verify:cpp` and `verify:determinism` require `cmake`.
