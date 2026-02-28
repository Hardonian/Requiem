# FIXLOG.md — Requiem Structural Upgrade

## Phase 0: Repo Truth + Baseline

### Environment
- **Node.js**: v24.12.0
- **pnpm**: 8.15.0
- **Git Branch**: main (up to date with origin/main)

### Repo Structure
- **C++ Core**: `src/*.cpp`, `include/requiem/*.hpp` — deterministic execution engine
- **TypeScript CLI**: `packages/cli/` — orchestration layer
- **TypeScript UI**: `packages/ui/` — design system components  
- **Next.js App**: `ready-layer/` — enterprise dashboard with API routes
- **Build System**: CMake (C++), pnpm workspaces (TS)

### Baseline Verification Results

| Component | Status | Notes |
|-----------|--------|-------|
| pnpm install | ✅ PASS | Lockfile up to date |
| CLI typecheck | ✅ PASS | No type errors |
| CLI lint | ❌ FAIL | ESLint config missing/invalid ("src" pattern) |
| UI typecheck | ✅ PASS | No type errors |
| UI lint | ❌ FAIL | ESLint config missing/invalid ("src" pattern) |

### Key Findings
1. **ESLint configs missing** for CLI and UI packages — need to add proper configs
2. **ready-layer** has Prisma + Supabase but no migrations enforcement scripts
3. **No explicit error envelope** — errors thrown as strings/unknown
4. **Tenant isolation** exists in code but no red-team verification
5. **Determinism invariants** well-documented and enforced via `verify_determinism.sh`

---

## Implementation Log

