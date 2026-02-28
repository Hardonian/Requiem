# Requiem Architecture

> **Version:** 1.3.0  
> **Last Updated:** 2026-02-27  
> **Status:** Production

## Overview

Requiem is a deterministic execution engine designed for reproducible builds, test isolation, and cryptographic verification of computation. It provides a multi-layered architecture that separates concerns between core logic, server-side operations, and user interfaces.

### Core Principles

1. **Determinism First**: Same inputs always produce identical outputs
2. **Defense in Depth**: Multiple layers of validation and enforcement
3. **Explicit Over Implicit**: State machines, error codes, and boundaries are explicit
4. **Server-Side Authority**: Tenant resolution and access control are server-side only

---

## Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer (packages/ui, ready-layer)                        │
│  - React components, design system                          │
│  - API route handlers (Next.js)                             │
│  - No direct DB access; calls server layer                  │
├─────────────────────────────────────────────────────────────┤
│  Server Layer (packages/cli/lib, ready-layer/api)           │
│  - Tenant resolution (server-side only)                     │
│  - Database access (Supabase/Prisma)                        │
│  - External service integration                             │
│  - Error envelope serialization                             │
├─────────────────────────────────────────────────────────────┤
│  Core Layer (packages/cli/lib, src/)                        │
│  - Deterministic algorithms                                 │
│  - State machines                                           │
│  - Clock abstractions                                       │
│  - Structured errors (types only)                           │
│  - No I/O, no side effects                                  │
├─────────────────────────────────────────────────────────────┤
│  Native Layer (src/*.cpp)                                   │
│  - BLAKE3 hashing                                           │
│  - CAS storage                                              │
│  - Sandbox execution                                        │
│  - Replay validation                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Module Boundaries

### Import Rules (Enforced by ESLint)

| From ↓ \ To → | Core | Server | UI | Native |
|---------------|------|--------|-----|--------|
| **Core** | ✅ | ❌ | ❌ | ❌ |
| **Server** | ✅ | ✅ | ❌ | ✅ (via adapter) |
| **UI** | ✅ | ❌ | ✅ | ❌ |
| **CLI** | ✅ | ✅ | ❌ | ✅ (via adapter) |

### Rule Details

- **Core** (`packages/cli/src/lib/errors.ts`, `clock.ts`, `state-machine.ts`):
  - Pure logic, deterministic
  - No filesystem, network, or environment access
  - May be imported by any layer

- **Server** (`packages/cli/src/lib/tenant.ts`, `db/`):
  - Database access, auth, external APIs
  - Never imported by UI layer
  - Tenant resolution is server-side only

- **UI** (`packages/ui/`, `ready-layer/src/app/`):
  - React components, route handlers
  - Never imports server-only modules directly
  - Communicates via HTTP/API boundaries

---

## Key Components

### 1. Structured Error Envelope (`packages/cli/src/lib/errors.ts`)

Unified error handling with stable identifiers:

```typescript
interface ErrorEnvelope {
  code: ErrorCode;           // Stable identifier
  message: string;           // Safe for UI display
  severity: ErrorSeverity;   // DEBUG, INFO, WARNING, ERROR, CRITICAL
  retryable: boolean;        // Client guidance
  phase?: string;            // Operation phase
  cause?: ErrorEnvelope;     // Chain preservation
  meta?: ErrorMeta;          // Safe context (no secrets)
  timestamp: string;         // ISO 8601
}
```

### 2. Tenant Resolution (`packages/cli/src/lib/tenant.ts`)

Single source of truth for tenant context:

```typescript
interface TenantContext {
  readonly tenantId: string;      // UUID
  readonly userId: string;        // User UUID
  readonly role: TenantRole;      // VIEWER | MEMBER | ADMIN | OWNER
  readonly derivedAt: string;     // ISO timestamp
  readonly derivedFrom: 'jwt' | 'api_key' | 'service_account';
}
```

**Invariant:** Tenant derivation is ALWAYS server-side. Client input is NEVER trusted.

### 3. State Machine (`packages/cli/src/lib/state-machine.ts`)

Explicit state transitions prevent impossible states:

```typescript
const machine = createExecutionStateMachine();
machine.transition('running', 'succeeded'); // ✅ Valid
machine.transition('succeeded', 'running'); // ❌ Throws (terminal state)
```

**Execution States:**
```
PENDING → QUEUED → RUNNING → SUCCEEDED
                      ↓
              [FAILED, TIMEOUT, CANCELLED, PAUSED]
                      ↓
                   QUEUED (retry)
```

### 4. Clock Abstraction (`packages/cli/src/lib/clock.ts`)

Deterministic time for reproducible execution:

```typescript
// Production
setGlobalClock(new SystemClock());

// Testing/Replay
setGlobalClock(new SeededClock(seedFromString(requestId), 1));
```

### 5. Native Engine (`src/`)

C++ core providing:
- **Hash**: BLAKE3 for all cryptographic operations
- **CAS**: Content-addressable storage with integrity
- **Sandbox**: Cross-platform process isolation
- **Replay**: Execution trace validation

---

## Data Flow

### Request Processing

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐
│  Client  │───▶│  API Route   │───▶│   Tenant     │───▶│  Handler │
│  Request │    │   Handler    │    │  Resolution  │    │          │
└──────────┘    └──────────────┘    └──────────────┘    └────┬─────┘
                                                             │
                         ┌───────────────────────────────────┘
                         ▼
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐
│  Client  │◄───│  Structured  │◄───│   Engine     │◄───│  Core    │
│ Response │    │    Error     │    │  (Native)    │    │  Logic   │
└──────────┘    └──────────────┘    └──────────────┘    └──────────┘
```

### Determinism Guarantee

```
Request JSON
    │
    ▼
Canonical JSON (sorted keys, no timestamps)
    │
    ▼
BLAKE3 Hash = Request Digest
    │
    ▼
Sandbox Execution (with seeded clock if replay)
    │
    ▼
Output Hash + Result Hash
    │
    ▼
Replay Validation: Recompute and verify
```

---

## Error Handling Strategy

### Layer-Specific Handling

| Layer | Strategy |
|-------|----------|
| **Core** | Throw `RequiemError` with codes |
| **Server** | Catch and wrap; log with context |
| **API** | Return structured JSON with HTTP status |
| **UI** | Display safe message; log correlation ID |

### HTTP Status Mapping

| Error Code | HTTP Status |
|------------|-------------|
| TENANT_NOT_FOUND | 404 |
| TENANT_ACCESS_DENIED | 403 |
| UNAUTHORIZED | 401 |
| VALIDATION_FAILED | 400 |
| ENGINE_UNAVAILABLE | 503 |
| DETERMINISM_VIOLATION | 500 |

---

## Multi-Tenancy

### Tenant Isolation

1. **Request Level**: JWT/API key → TenantContext
2. **Query Level**: All queries include `tenant_id` filter
3. **Database Level**: RLS policies enforce tenant boundaries
4. **Cache Level**: Keys prefixed with `tenant:{id}:`

### Role Hierarchy

```
OWNER (3)
  └─ Full control, billing access

ADMIN (2)
  └─ Manage users, settings

MEMBER (1)
  └─ Create runs, view data

VIEWER (0)
  └─ Read-only access
```

---

## Configuration

### Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `REQUIEM_TENANT_ID` | CLI tenant context | CLI only |
| `REQUIEM_API_KEY` | CLI authentication | CLI only |
| `REQUIEM_ENGINE_PATH` | Native binary path | Optional |
| `REQUIEM_CAS_PATH` | CAS storage directory | Optional |

### Config Snapshots

Captured at execution start for replay verification:

```typescript
interface ConfigSnapshot {
  version: string;          // Config schema version
  values: Record<string, unknown>;  // Relevant config
  capturedAt: string;       // ISO timestamp
  clockSeed?: number;       // If using seeded clock
}
```

---

## Extension Points

### Adding New Error Codes

1. Add to `ErrorCode` enum in `packages/cli/src/lib/errors.ts`
2. Add HTTP status mapping in `errorToHttpStatus()`
3. Add factory method in `Errors` object (optional)

### Adding New States

1. Define state in state machine config
2. Add transitions to `allowedTransitions`
3. Generate SQL CHECK constraint
4. Update documentation

### Adding New Tenant Sources

1. Implement `TenantResolver` interface
2. Add to `derivedFrom` type
3. Update `requireTenantContext()` helper

---

## References

- [INVARIANTS.md](./INVARIANTS.md) — Hard system constraints
- [OPERATIONS.md](./OPERATIONS.md) — Runbooks and procedures
- [THREAT_MODEL.md](./THREAT_MODEL.md) — Security analysis
- [DETERMINISM.md](./DETERMINISM.md) — Determinism guarantees
