# ReadyLayer Integration Plan

**Status**: In Progress  
**Last Updated**: 2026-02-28  
**Integration Phase**: 2-8 Execution  

---

## 1. Discovery Summary

### 1.1 Repository Context
```
PWD: /workspace/55c1d8fa-41c6-4fdb-8965-3f34f401d157/sessions/agent_b0285571-6beb-46bf-8cf2-c7f78956d705
Git Branch: session/agent_b0285571-6beb-46bf-8cf2-c7f78956d705
Git Status: Clean working tree
Package Manager: pnpm@8.15.0
Node: >=18.0.0
```

### 1.2 ReadyLayer Location

| Component | Path | Entry Commands |
|-----------|------|----------------|
| ReadyLayer Web App | `ready-layer/` | `npm run dev`, `npm run build` |
| Package Definition | `ready-layer/package.json` | `name: "ready-layer"` |
| Next.js Config | `ready-layer/next.config.ts` | App Router, static + dynamic |
| App Pages | `ready-layer/src/app/` | `/app/*` console routes |
| API Routes | `ready-layer/src/app/api/` | `/api/*` REST endpoints |
| Prisma Schema | `ready-layer/prisma/schema.prisma` | Database layer |
| Middleware | `ready-layer/src/middleware.ts` | Auth/proxy handling |

### 1.3 Repository Structure

```
requiem/
├── packages/
│   ├── ai/           # AI/MCP integration layer
│   ├── cli/          # @requiem/cli - CLI commands
│   └── ui/           # @requiem/ui - Design system
├── ready-layer/      # ReadyLayer Next.js web app (enterprise)
├── src/              # Requiem kernel (C++ runtime)
├── docs/             # Documentation
├── scripts/          # Verification scripts
├── routes.manifest.json  # Canonical route manifest
└── pnpm-workspace.yaml   # Monorepo workspace config
```

---

## 2. Integration Architecture

### 2.1 "ReadyLayer is Web Frontend" - File + Route Terms

ReadyLayer serves as the **canonical web interface** for Requiem:

| Concept | File Location | Route | Purpose |
|---------|--------------|-------|---------|
| Landing/Marketing | `src/app/page.tsx` | `/` | Redirects to console |
| Console Dashboard | `src/app/app/executions/page.tsx` | `/app/executions` | Main operator view |
| CAS Explorer | `src/app/app/cas/page.tsx` | `/app/cas` | Content-addressed storage |
| Diagnostics | `src/app/app/diagnostics/page.tsx` | `/app/diagnostics` | System health |
| Metrics | `src/app/app/metrics/page.tsx` | `/app/metrics` | Observability |
| Replay | `src/app/app/replay/page.tsx` | `/app/replay` | Deterministic replay |
| Tenant Admin | `src/app/app/tenants/page.tsx` | `/app/tenants` | Multi-tenant mgmt |

### 2.2 Domain Representation

| Domain | Code Representation | Notes |
|--------|---------------------|-------|
| `reach-cli.com` (OSS) | Static marketing pages + docs | Open source, no auth required |
| `ready-layer.com` (Enterprise) | `/app/*` console routes | Auth-gated, full feature set |

---

## 3. Monorepo Wiring

### 3.1 Current State
- **Already configured**: `pnpm-workspace.yaml` includes `ready-layer`
- **Workspace packages**: `packages/*` + `ready-layer`
- **Lock file**: `pnpm-lock.yaml` exists at root

### 3.2 Integration Points

```yaml
# pnpm-workspace.yaml (existing)
packages:
  - "packages/*"
  - "ready-layer"
```

### 3.3 Dependency Flow
```
root (requiem)
├── packages/ai ───────┐
├── packages/cli ──────┼── consumed by ───┐
├── packages/ui ───────┘                  │
│                                         ▼
└── ready-layer (web app) ←─────────── depends on ───┘
```

---

## 4. Static Generation Strategy (Vercel)

### 4.1 Route Categories

| Route Pattern | Type | Generation |
|--------------|------|------------|
| `/` | Redirect | Dynamic (middleware) |
| `/app/*` | Console | Static + Client hydration |
| `/api/*` | API | Dynamic (serverless functions) |

### 4.2 Build Configuration
- **Output**: `next build` produces static + serverless
- **Static pages**: Marketing/landing (to be added)
- **Dynamic pages**: Console requires auth/session
- **API routes**: Serverless functions for data

### 4.3 Required Additions
1. `generateStaticParams()` for dynamic routes
2. `dynamic = 'force-static'` for marketing pages
3. `fetch` caching rules for API data
4. Route manifest verification script

---

## 5. Console/Playground/Enterprise Experience

### 5.1 Current Pages
- ✅ `/app/executions` - Execution history
- ✅ `/app/cas` - CAS browser
- ✅ `/app/diagnostics` - System diagnostics
- ✅ `/app/metrics` - Metrics dashboard
- ✅ `/app/replay` - Replay debugger
- ✅ `/app/tenants` - Tenant management

### 5.2 Required Additions
- 🔄 `/playground` - Interactive workflow builder (no backend)
- 🔄 `/enterprise` - Feature matrix, pricing, docs
- 🔄 `/docs` - Static documentation pages

### 5.3 Backend Abstraction
- **Kernel APIs exist**: Connect via typed client
- **Fallback**: Mock provider for demo mode
- **No broken UX**: All pages work without backend (demo data)

---

## 6. CLI Integration Points

### 6.1 Existing CLI Commands
```bash
requiem web          # Start web app (from root: npm run start:mcp)
requiem web:build    # Build web app
requiem web:routes   # Verify routes (scripts/verify_routes.sh)
```

### 6.2 CLI Package Location
- **Package**: `packages/cli/`
- **Binary**: `@requiem/cli`
- **Commands**: `decide`, `junctions` (existing)

### 6.3 Required Additions
- Add `web`, `web:build`, `web:routes` commands to CLI
- Cross-platform support (Windows/Linux/macOS)

---

## 7. Security & Boundaries

### 7.1 Tenant Isolation
- Middleware enforces auth boundaries
- No cross-tenant data leakage
- Feature flags for enterprise-only routes

### 7.2 Secret Management
- Server-side env vars only in API routes
- Client-safe `NEXT_PUBLIC_*` vars only
- No engine binary calls from frontend

### 7.3 Failure Modes
- No hard 500 pages
- Error boundaries on all routes
- Graceful degradation when APIs unavailable

---

## 8. Verification Checklist

### 8.1 Scripts to Add/Update
| Script | Purpose | Location |
|--------|---------|----------|
| `verify:full` | Lint + typecheck + build + test + routes | Root package.json |
| `verify:routes` | Validate route manifest | scripts/verify-routes.ts |
| `web:dev` | Start ReadyLayer dev server | Root package.json |
| `web:build` | Build ReadyLayer for production | Root package.json |

### 8.2 CI Requirements
- Run `verify:full` on PR/push
- Route verification must pass
- Build must produce all static pages
- No 500 errors in smoke tests

---

## 9. Implementation Phases

### Phase 2: Discovery ✅
- [x] Map repository structure
- [x] Identify ReadyLayer location
- [x] Document integration plan

### Phase 3: Monorepo Wiring
- [ ] Verify pnpm workspace integrity
- [ ] Install dependencies from root
- [ ] Standardize tsconfig paths

### Phase 4: Static Generation
- [ ] Audit Next.js config
- [ ] Create route manifest verifier
- [ ] Add generateStaticParams
- [ ] Configure static/dynamic boundaries

### Phase 5: Console/Playground/Enterprise
- [ ] Add playground route
- [ ] Add enterprise section
- [ ] Implement mock provider
- [ ] Add Playwright smoke tests

### Phase 6: CLI Integration
- [ ] Add web commands to CLI
- [ ] Cross-platform wrapper
- [ ] Update documentation

### Phase 7: Hardening
- [ ] Multi-tenant hygiene review
- [ ] Typed env validation
- [ ] Error boundaries
- [ ] Bundle analysis

### Phase 8: Final Green
- [ ] Create verify:full script
- [ ] Update CI workflow
- [ ] Finalize README
- [ ] Confirm all tests pass
