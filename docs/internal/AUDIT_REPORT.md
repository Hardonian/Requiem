# Tenant Isolation Security Audit Report

**Audit Date:** 2026-02-28  
**Phase:** 1 - End-to-End Audit  
**Classification:** Internal Security Assessment  

---

## Executive Summary

This audit identified **CRITICAL** tenant isolation vulnerabilities in the Requiem codebase. The most severe issue is that tenant identity is derived from client-supplied HTTP headers rather than from validated authentication tokens, enabling cross-tenant data access attacks.

---

## 1. TENANT MODEL IDENTIFICATION

### 1.1 Database Schema (ready-layer/migrations/20260228000000_vector_search_initial.sql)

| Table | Purpose | tenant_id Column |
|-------|---------|------------------|
| `tenants` | Tenant registry | `id` (UUID, primary key) |
| `tenant_members` | User membership | `tenant_id` (UUID, FK to tenants) |
| `vector_documents` | Document storage | `tenant_id` (UUID) |
| `vector_embeddings` | Embeddings index | `tenant_id` (UUID) |
| `vector_queries_log` | Query audit log | `tenant_id` (UUID) |

### 1.2 Tenant ID Source Analysis

**Finding:** Tenant ID is **client-supplied** via HTTP header, not derived from JWT claims.

| File | Line | Issue |
|------|------|-------|
| `ready-layer/src/lib/auth.ts` | 70, 82 | `X-Tenant-ID` header is trusted |
| `ready-layer/src/lib/engine-client.ts` | 65 | Tenant ID passed to backend via header |

---

## 2. CRITICAL SECURITY FINDINGS

### FINDING #1: Client-Supplied Tenant ID (BLOCKER)

**Severity:** BLOCKER  
**File:** `ready-layer/src/lib/auth.ts`  
**Lines:** 68-90

**Evidence:**
```typescript
// Line 68-75: Dev mode accepts any tenant from header
if (!process.env.REQUIEM_AUTH_SECRET) {
  // Dev mode: accept any token, derive tenant from header
  const tenantHeader = req.headers.get('X-Tenant-ID') ?? 'dev-tenant';
  return {
    ok: true,
    tenant: { tenant_id: tenantHeader, auth_token: token },
  };
}

// Line 82-90: Production also trusts client-supplied tenant
const tenantHeader = req.headers.get('X-Tenant-ID');
if (!tenantHeader) {
  return { ok: false, error: 'missing_tenant_id', status: 400 };
}
return {
  ok: true,
  tenant: { tenant_id: tenantHeader, auth_token: token },
};
```

**Attack Vector:** An authenticated attacker can send any `X-Tenant-ID` header value to access data from other tenants.

**Recommended Fix:**
```typescript
// Derive tenant_id from validated JWT claims, not headers
const payload = await verifyJWT(token, process.env.JWT_SECRET!);
const tenant_id = payload.tenant_id; // From token claims
```

---

### FINDING #2: RPC Functions Accept Unsanitized tenant_id (BLOCKER)

**Severity:** BLOCKER  
**File:** `ready-layer/migrations/20260228000000_vector_search_initial.sql`  
**Lines:** 359-398, 401-439

**Evidence:**
```sql
-- Line 359-365: RPC function accepts tenant_id as parameter
CREATE OR REPLACE FUNCTION vector_search(
    p_tenant_id uuid,  -- Client-controlled!
    p_query_embedding vector(1536),
    p_index_key text,
    p_limit int DEFAULT 10,
    p_min_similarity float DEFAULT 0.7
)
```

**Issue:** The RPC functions `vector_search`, `search_documents_text`, and `log_vector_query` all accept `tenant_id` as a parameter without validating that the calling user belongs to that tenant.

**Recommended Fix:**
```sql
-- Add auth.uid() validation to RPC functions
CREATE OR REPLACE FUNCTION vector_search(
    p_query_embedding vector(1536),
    p_index_key text,
    p_limit int DEFAULT 10,
    p_min_similarity float DEFAULT 0.7
)
RETURNS TABLE (...)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_tenant_id uuid;
BEGIN
    -- Derive tenant from auth context, not parameter
    v_tenant_id := (
        SELECT tenant_id 
        FROM tenant_members 
        WHERE user_id = auth.uid()
        LIMIT 1
    );
    
    -- Use derived tenant_id in query
    RETURN QUERY
    SELECT ... WHERE ve.tenant_id = v_tenant_id;
END;
$$;
```

---

### FINDING #3: Missing RLS Enforcement on RPC Functions (HIGH)

**Severity:** HIGH  
**File:** `ready-layer/migrations/20260228000000_vector_search_initial.sql`  
**Lines:** 359-468

**Issue:** While RLS policies exist on the tables, RPC functions bypass RLS when called directly. The migration creates functions that run with SECURITY DEFINER privilege (implied), which bypasses RLS.

**Recommended Fix:**
```sql
-- Add SECURITY DEFINER and explicit tenant validation
CREATE OR REPLACE FUNCTION vector_search(...)
...
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id uuid;
BEGIN
    -- Verify user membership
    IF NOT is_tenant_member(p_tenant_id, auth.uid()) THEN
        RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id;
    END IF;
    ...
```

---

### FINDING #4: Dev Mode Authentication Bypass (HIGH)

**Severity:** HIGH  
**File:** `ready-layer/src/lib/auth.ts`  
**Lines:** 68-75

**Evidence:**
```typescript
if (!process.env.REQUIEM_AUTH_SECRET) {
  // Dev mode: accept any token, derive tenant from header
  const tenantHeader = req.headers.get('X-Tenant-ID') ?? 'dev-tenant';
  return {
    ok: true,
    tenant: { tenant_id: tenantHeader, auth_token: token },
  };
}
```

**Issue:** In development mode, any token is accepted and any tenant can be accessed. This is a security risk if accidentally deployed to production.

**Recommended Fix:**
```typescript
// Add explicit dev mode flag check
if (process.env.NODE_ENV === 'development' && !process.env.REQUIEM_AUTH_SECRET) {
  // Strictly limit dev mode to localhost
  const isLocalhost = req.headers.get('host')?.startsWith('localhost');
  if (!isLocalhost) {
    return { ok: false, error: 'dev_mode_blocked', status: 403 };
  }
  ...
}
```

---

### FINDING #5: CLI Has No Tenant Isolation (MEDIUM)

**Severity:** MEDIUM  
**File:** `packages/cli/src/db/connection.ts`  
**Lines:** 219-268

**Evidence:**
```typescript
// No tenant_id column in any table
dbInstance.exec(`
  CREATE TABLE IF NOT EXISTS junctions (
    id TEXT PRIMARY KEY,
    ...
    -- NO tenant_id column!
  )
`);

dbInstance.exec(`
  CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY,
    ...
    -- NO tenant_id column!
  )
`);
```

**Issue:** The CLI uses an in-memory database with no tenant concept. All data is shared globally.

**Recommended Fix:** Add tenant_id to all CLI tables and require tenant context in CLI commands.

---

### FINDING #6: Public Route Disclosure (LOW)

**Severity:** LOW  
**File:** `ready-layer/src/app/api/health/route.ts`  
**Lines:** 25-29

**Evidence:**
```typescript
{
  name: 'tenant_auth_configured',
  ok: Boolean(process.env.REQUIEM_AUTH_SECRET),
  message: process.env.REQUIEM_AUTH_SECRET
    ? 'Auth secret present'
    : 'REQUIEM_AUTH_SECRET not set — auth disabled',
}
```

**Issue:** Public health endpoint discloses whether authentication is enabled.

**Recommended Fix:** Always return `ok: true` and generic message for security checks.

---

## 3. DATA ACCESS TOUCHPOINTS SUMMARY

| Component | Tenant Isolation Status |
|-----------|------------------------|
| API Routes (`/api/vector/search`) | Uses client-supplied X-Tenant-ID header |
| RPC Functions | Accept tenant_id parameter without validation |
| Supabase Client | Uses anon key (good), but tenant_id from header |
| CLI Database | No tenant isolation |
| Engine Client | Passes tenant via header to backend |

---

## 4. POSITIVE SECURITY OBSERVATIONS

1. **RLS Policies Exist:** Database migration includes RLS policies for all tenant tables (lines 139-296)
2. **Supabase Anon Key:** Uses anon key, not service_role key for client operations
3. **Public Routes List:** Explicit allow-list exists in auth.ts (lines 35-40)
4. **Auth Comments:** Code includes security invariant comments

---

## 5. RECOMMENDED IMMEDIATE ACTIONS

1. **PRIORITY 1:** Replace client-supplied tenant_id with JWT-derived tenant_id
2. **PRIORITY 2:** Add tenant membership validation to all RPC functions
3. **PRIORITY 3:** Disable dev mode authentication bypass in production
4. **PRIORITY 4:** Add tenant_id to CLI database schema
5. **PRIORITY 5:** Add automated tenant isolation tests

---

## 6. AFFECTED FILES

| File | Severity |
|------|----------|
| `ready-layer/src/lib/auth.ts` | BLOCKER |
| `ready-layer/migrations/20260228000000_vector_search_initial.sql` | BLOCKER |
| `ready-layer/src/lib/vector-search.ts` | BLOCKER |
| `packages/cli/src/db/connection.ts` | MEDIUM |
| `ready-layer/src/app/api/health/route.ts` | LOW |

---

*End of Report*
