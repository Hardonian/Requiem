# Requiem Implementation Plan - All Audit Items

## Overview

This plan covers implementation of ALL items from:
- Theatre Audit (Phase 1)
- Security Audit (Phase 2) 
- Tool Registry Audit (Phase 3)
- Reality Check Fixes (Phase 4)
- Documentation Updates (Phase 5)

---

## PHASE 1: Theatre Audit Items

### 1.1 Signed Result Bundles (CRITICAL - Stub → Real)
**Current State**: Structure exists in `provenance_bundle.hpp` with Ed25519 signing functions declared
**Required Work**:
- Implement actual Ed25519 signing in `src/provenance_bundle.cpp`
- Wire `sign_bundle()` into `BundleBuilder::build()`
- Add key management (REQUIEM_SIGNING_KEY env var parsing)
- Implement `verify_bundle_signature()` function
- Add tests for signing/verification

**Files to Modify**:
- `src/provenance_bundle.cpp` (new implementation)
- `tests/requiem_tests.cpp` (add signing tests)

### 1.2 Seccomp-BPF Sandbox (NOT-IMPLEMENTED)
**Current State**: Types exist but `install_seccomp_filter()` is not wired into `run_process()`
**Required Work**:
- Implement `install_seccomp_filter()` in `src/sandbox_posix.cpp`
- Wire into `run_process()` when `enforce_seccomp=true`
- Add default allowlist (read, write, exec, etc.)
- Add blocklist for dangerous syscalls
- Add Linux-only compilation guard

**Files to Modify**:
- `src/sandbox_posix.cpp` (implement seccomp)
- `include/requiem/sandbox.hpp` (update comments)

### 1.3 Windows Restricted Tokens (PARTIAL)
**Current State**: `create_restricted_token()` declared but not wired
**Required Work**:
- Implement `create_restricted_token()` in `src/sandbox_win.cpp`
- Wire into `run_process()` for Windows when `enforce_seccomp=true`
- Implement `apply_windows_mitigations()`
- Test on Windows environment

**Files to Modify**:
- `src/sandbox_win.cpp` (implement restricted tokens)

### 1.4 Audit Log Persistence (IN-MEMORY ONLY)
**Current State**: Writes to local NDJSON file, no database
**Required Work**:
- Implement production `AuditSink` backed by database
- Add Postgres/WAL support
- Add S3 + object-lock support
- Implement tamper-evident chaining (BLAKE3 of previous record)

**Files to Create/Modify**:
- `packages/ai/src/telemetry/audit.ts` (add DB sink)
- `packages/ai/src/migrations/` (add audit tables)

### 1.5 Merkle Audit Chain (NOT-IMPLEMENTED)
**Current State**: Flag exists but no code implements Merkle linking
**Required Work**:
- Implement Merkle tree construction
- Each audit record includes `prev_hash = BLAKE3(previous_record)`
- Root hash published/stored separately
- Verification tool to walk chain and check links

**Files to Create/Modify**:
- `packages/ai/src/telemetry/audit.ts` (add Merkle chain)
- New verification tool

### 1.6 Budget Enforcement (IN-MEMORY ONLY)
**Current State**: `AtomicBudgetChecker` in-memory only, resets on restart
**Required Work**:
- Implement `PersistentBudgetChecker` using database
- Use Redis or Postgres for atomic increment
- Implement distributed rate limiting (token bucket in Redis)
- Multi-instance coordination

**Files to Modify**:
- `packages/ai/src/policy/budgets.ts` (add PersistentBudgetChecker)
- `packages/ai/src/migrations/` (add budget tables)

---

## PHASE 2: Security Audit Items (BLOCKER/HIGH/MEDIUM/LOW)

### 2.1 Client-Supplied Tenant ID (BLOCKER)
**Current State**: `X-Tenant-ID` header is trusted, not derived from JWT
**Required Work**:
- Modify `ready-layer/src/lib/auth.ts` to derive tenant_id from JWT claims
- Remove trust in `X-Tenant-ID` header
- Add `tenant_id` extraction from validated JWT payload

**Files to Modify**:
- `ready-layer/src/lib/auth.ts`

### 2.2 RPC Functions Unsanitized tenant_id (BLOCKER)
**Current State**: RPC functions accept tenant_id as parameter without validation
**Required Work**:
- Modify RPC functions to derive tenant from auth context
- Add `auth.uid()` validation
- Use derived tenant_id in queries (not parameter)

**Files to Modify**:
- `ready-layer/migrations/20260228000000_vector_search_initial.sql`

### 2.3 Missing RLS Enforcement (HIGH)
**Current State**: RPC functions bypass RLS with SECURITY DEFINER
**Required Work**:
- Add explicit tenant validation to RPC functions
- Add `is_tenant_member()` check
- Implement proper SECURITY DEFINER with RLS

**Files to Modify**:
- `ready-layer/migrations/...vector_search_initial.sql`

### 2.4 Dev Mode Authentication Bypass (HIGH)
**Current State**: Dev mode accepts any token, any tenant
**Required Work**:
- Add explicit `NODE_ENV === 'development'` check
- Limit dev mode to localhost only
- Add host header validation

**Files to Modify**:
- `ready-layer/src/lib/auth.ts`
- `packages/ai/src/mcp/transport-next.ts`

### 2.5 CLI Tenant Isolation (MEDIUM)
**Current State**: CLI database has no tenant_id column
**Required Work**:
- Add tenant_id to all CLI tables
- Require tenant context in CLI commands
- Add multi-tenant support

**Files to Modify**:
- `packages/cli/src/db/connection.ts`

### 2.6 Public Route Disclosure (LOW)
**Current State**: Health endpoint discloses auth configuration
**Required Work**:
- Always return `ok: true` for security checks
- Use generic messages

**Files to Modify**:
- `ready-layer/src/app/api/health/route.ts`

---

## PHASE 3: Tool Registry Audit Items

### 3.1 ToolDefinition Fields
**Current State**: Already implemented in `docs/MCP.md`:
- `deterministic: boolean` ✅
- `idempotent: boolean` ✅
- `version: string` ✅
- `tenantScoped: boolean` ✅

**No work needed** - Already complete!

### 3.2 Cross-Tenant Probe Vulnerability (CRITICAL)
**Current State**: `decide_explain` doesn't verify junction belongs to tenant
**Required Work**:
- Add tenant check to `handleExplain`
- Verify junction belongs to current requester's tenant
- Add tenant_id filter to all repository queries

**Files to Modify**:
- `packages/cli/src/commands/decide.ts`

### 3.3 Resource Bomb Vulnerability (HIGH)
**Current State**: No size limit on `trigger_data` JSON parsing
**Required Work**:
- Add size limit check before JSON.parse
- Add max trigger_data size constant
- Reject oversized payloads with error

**Files to Modify**:
- `packages/cli/src/commands/decide.ts`

### 3.4 Replay Conflict Vulnerability (MEDIUM)
**Current State**: No idempotency check, duplicates created on retry
**Required Work**:
- Add idempotency key to decision creation
- Check for existing decision before create
- Use upsert instead of create

**Files to Modify**:
- `packages/cli/src/commands/decide.ts`
- `packages/cli/src/db/DecisionRepository.ts`

---

## PHASE 4: Reality Check Items

### 4.1 Seccomp Implementation
**Current State**: Marked as unsupported
**Required Work**: Same as 1.2 - Implement full seccomp

### 4.2 Windows Restricted Tokens
**Current State**: Marked as unsupported  
**Required Work**: Same as 1.3 - Implement full restricted tokens

### 4.3 Full LLM Freeze Flow
**Current State**: Stub exists, needs provider integration
**Required Work**:
- Integrate with LLM providers (OpenAI, Anthropic)
- Implement freeze/unfreeze workflow
- Add state management

### 4.4 Plugin ABI Implementation
**Current State**: Structures defined, loading not implemented
**Required Work**:
- Implement dynamic library loading
- Add plugin discovery
- Implement ABI versioning

### 4.5 mmap Optimization for CAS
**Current State**: Uses streams, mmap not implemented
**Required Work**:
- Implement mmap for CAS reads
- Add memory-mapped file support
- Benchmark and optimize

---

## PHASE 5: Documentation & Verification

### 5.1 Update Documentation
- Update THEATRE_AUDIT.md with implementation status
- Update CONTRACT.md with new fields
- Update SECURITY.md with fixes applied
- Update all audit documents to mark items complete

### 5.2 Verification Tests
- Run full test suite
- Run verification scripts
- Verify tenant isolation
- Verify signing works

---

## Execution Order

```
Phase 1 (Parallel where possible):
├── 1.1 Signed Result Bundles
├── 1.2 Seccomp-BPF
├── 1.3 Windows Restricted Tokens
├── 1.4 Audit Persistence
├── 1.5 Merkle Chain
└── 1.6 Budget Persistence

Phase 2 (Sequential - security critical):
├── 2.1 Client-Supplied Tenant ID (BLOCKER)
├── 2.2 RPC Functions (BLOCKER)
├── 2.3 RLS Enforcement (HIGH)
├── 2.4 Dev Mode Bypass (HIGH)
├── 2.5 CLI Isolation (MEDIUM)
└── 2.6 Public Route Disclosure (LOW)

Phase 3:
├── 3.1 ToolDefinition (ALREADY DONE)
├── 3.2 Cross-Tenant Probe
├── 3.3 Resource Bomb
└── 3.4 Replay Conflict

Phase 4:
├── 4.1-4.5 Reality Check Items

Phase 5:
├── 5.1 Documentation
└── 5.2 Verification
```

---

## Risk Assessment

| Item | Complexity | Risk | Priority |
|------|------------|------|----------|
| Signed Bundles | High | High | P1 |
| Seccomp | High | High | P1 |
| Tenant Isolation Fixes | Medium | Critical | P1 |
| Audit Persistence | Medium | High | P2 |
| Merkle Chain | Medium | Medium | P2 |
| Budget Persistence | Medium | Medium | P2 |
| Windows Tokens | High | Medium | P2 |
| Tool Vulnerabilities | Low | Critical | P1 |
| Plugin ABI | High | Low | P3 |
| mmap Optimization | Medium | Low | P3 |
