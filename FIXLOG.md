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

### 2026-02-28 - Phase 0 Baseline

#### Baseline Verification Results (Updated)

| Component | Status | Notes |
|-----------|--------|-------|
| pnpm install | ✅ PASS | Lockfile up to date |
| CLI typecheck | ✅ PASS | No type errors |
| CLI lint | ❌ FAIL | 47 errors - `any` type usage in multiple files |
| UI typecheck | ✅ PASS | No type errors |
| UI lint | ✅ PASS | No lint errors |
| ready-layer typecheck | ❌ FAIL | TS2345: Argument type error in autotune/route.ts |
| ready-layer lint | ❌ FAIL | Missing eslint.config.js (ESLint v9 migration needed) |

#### New Findings
- **CLI lint errors**: 47 ESLint errors, mostly `@typescript-eslint/no-explicit-any` (files: decide.ts, junctions.ts, connection.ts, decisions.ts, junctions.ts, adapter.ts, types.ts)
- **ready-layer typecheck error**: `src/app/api/engine/autotune/route.ts(79,56)`: Argument of type 'string' is not assignable to parameter of type '"tick" | "revert"'.
- **ready-layer lint error**: Missing eslint.config.js - ESLint v9 migration needed
- **No eslint.config** in ready-layer for ESLint v9

#### Repo Stack Summary
- **C++ Core**: CMake build system (`src/*.cpp`, `include/requiem/*.hpp`)
- **TypeScript CLI**: `@requiem/cli` v0.1.0 - commands: decide, junctions, doctor
- **TypeScript UI**: `@requiem/ui` v0.1.0 - React components with Radix UI
- **Next.js App**: `ready-layer` v1.0.0 - enterprise dashboard, Prisma + Supabase
- **pnpm workspaces**: root with 3 packages (cli, ui, ready-layer)

