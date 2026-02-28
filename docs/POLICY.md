# Policy Enforcement Documentation

This document describes the policy-as-code enforcement layers in the Requiem system.

## Overview

Requiem implements defense-in-depth policy enforcement with multiple layers:

1. **Budget Enforcement** - Controls resource consumption per tenant
2. **RBAC/Capabilities** - Role-based access control
3. **Policy Gate** - Central decision engine for tool execution
4. **Audit Logging** - Immutable record of all policy decisions

---

## 1. Budget Enforcement

### Architecture

Budget enforcement prevents tenants from exceeding their allocated resource limits.

### Files

| File | Description |
|------|-------------|
| [`packages/ai/src/policy/budgets.ts`](packages/ai/src/policy/budgets.ts) | Main budget enforcement logic |
| [`packages/cli/src/lib/tools.ts`](packages/cli/src/lib/tools.ts) | CLI budget enforcement |

### Key Components

#### DefaultBudgetChecker (AI Package)

**Location:** [`packages/ai/src/policy/budgets.ts:53-223`](packages/ai/src/policy/budgets.ts:53)

**Behavior:**
- Enforces budget limits based on tenant tier (free vs enterprise)
- Default: DENY if no configuration exists (fail-safe)
- Free tier: $10/month limit (1000 cents)
- Enterprise: Unlimited (configurable)

**Configuration:**
```typescript
DefaultBudgetChecker.configureTenant(tenantId, 'free' | 'enterprise', customLimits?)
```

**Key Methods:**
- `check(tenantId, estimatedCostCents)` - Returns `{ allowed, reason, remaining }`
- `record(tenantId, actualCostCents, tokens?)` - Reconciles actual vs estimated

#### AtomicBudgetChecker (AI Package)

**Location:** [`packages/ai/src/policy/budgets.ts:237-372`](packages/ai/src/policy/budgets.ts:237)

**Behavior:**
- Atomic compare-and-swap to prevent race conditions
- Per-tenant mutex locking
- Window-based limits with automatic reset

#### CLI Budget Enforcement

**Location:** [`packages/cli/src/lib/tools.ts:14-180`](packages/cli/src/lib/tools.ts:14)

**Functions:**
- `checkBudget(tenantId, estimatedCostCents)` - Atomic budget check
- `recordBudgetUsage(tenantId, actualCostCents)` - Record actual usage
- `setCLIBudgetTier(tenantId, tier)` - Configure tenant tier
- `getCLIBudgetState(tenantId)` - Get current usage state

---

## 2. RBAC & Capabilities

### Architecture

Role-Based Access Control (RBAC) with fine-grained capabilities.

### Files

| File | Description |
|------|-------------|
| [`packages/ai/src/policy/capabilities.ts`](packages/ai/src/policy/capabilities.ts) | Capability definitions and role mapping |
| [`packages/ai/src/types/index.ts`](packages/ai/src/types/index.ts) | TenantRole enum |

### Capability Definitions

**Location:** [`packages/ai/src/policy/capabilities.ts:19-44`](packages/ai/src/policy/capabilities.ts:19)

```typescript
const Capabilities = {
  TOOLS_READ: 'tools:read',
  TOOLS_WRITE: 'tools:write',
  TOOLS_ADMIN: 'tools:admin',
  AI_GENERATE: 'ai:generate',
  AI_ADMIN: 'ai:admin',
  MEMORY_READ: 'memory:read',
  MEMORY_WRITE: 'memory:write',
  SKILLS_RUN: 'skills:run',
  SKILLS_ADMIN: 'skills:admin',
  COST_READ: 'cost:read',
  COST_ADMIN: 'cost:admin',
  EVAL_RUN: 'eval:run',
  EVAL_ADMIN: 'eval:admin',
};
```

### Role Hierarchy

**Location:** [`packages/ai/src/types/index.ts:16-21`](packages/ai/src/types/index.ts:16)

```typescript
enum TenantRole {
  VIEWER = 'viewer',    // Read-only
  MEMBER = 'member',    // Can execute tools
  ADMIN = 'admin',      // Full access
  OWNER = 'owner',      // Administrative
}
```

### Role → Capabilities Mapping

**Location:** [`packages/ai/src/policy/capabilities.ts:54-101`](packages/ai/src/policy/capabilities.ts:54)

| Role | Capabilities |
|------|-------------|
| VIEWER | tools:read, memory:read, cost:read |
| MEMBER | + tools:write, ai:generate, memory:write, skills:run, eval:run |
| ADMIN | + tools:admin, ai:admin, skills:admin, cost:admin, eval:admin |
| OWNER | All capabilities |

---

## 3. Policy Gate

### Architecture

Central decision engine that evaluates all tool execution requests.

### Files

| File | Description |
|------|-------------|
| [`packages/ai/src/policy/gate.ts`](packages/ai/src/policy/gate.ts) | Main policy gate implementation |
| [`packages/ai/src/tools/registry.ts`](packages/ai/src/tools/registry.ts) | Tool registry with policy gate integration |

### Evaluation Flow

**Location:** [`packages/ai/src/policy/gate.ts:26-85`](packages/ai/src/policy/gate.ts:26)

1. **Sync Checks** (fast path):
   - Tenant scoping validation
   - Capability requirements
   - Side-effect restrictions for VIEWER role

2. **Async Checks** (budget path):
   - Budget availability check
   - Atomic cost reservation

### PolicyDecision Interface

**Location:** [`packages/ai/src/policy/gate.ts:18-22`](packages/ai/src/policy/gate.ts:18)

```typescript
interface PolicyDecision {
  allowed: boolean;
  reason: string;
  requiredRole?: TenantRole;
}
```

### Key Invariants

- **Deny-by-default**: Any missing metadata results in deny
- **Tenant isolation**: Context never derived from input
- **VIEWER restriction**: Cannot execute side-effect tools

---

## 4. Audit Logging

### Architecture

Immutable audit trail of all policy decisions.

### Files

| File | Description |
|------|-------------|
| [`packages/ai/src/telemetry/audit.ts`](packages/ai/src/telemetry/audit.ts) | AI package audit logging |
| [`packages/ai/src/tools/types.ts`](packages/ai/src/tools/types.ts) | ToolAuditRecord schema |
| [`packages/cli/src/lib/tools.ts`](packages/cli/src/lib/tools.ts) | CLI audit logging |

### Audit Record Schema

**Location:** [`packages/ai/src/tools/types.ts:88-130`](packages/ai/src/tools/types.ts:88)

```typescript
interface ToolAuditRecord {
  // Identification
  timestamp: string;           // ISO 8601
  actorId: string;              // Principal
  tenantId: string | null;     // Tenant context
  traceId: string;             // Distributed trace

  // Action
  toolName: string;
  toolVersion: string;
  inputHash?: string;          // SHA-256 of input (not full input)

  // Decision
  decision: 'allow' | 'deny';
  reason: string;
  policyRuleId?: string;       // Which rule triggered decision

  // Budget info (if applicable)
  budget?: {
    estimatedCostCents: number;
    limitCents: number;
    remainingCents: number;
    tier: string;
  };

  // Execution
  latencyMs: number | null;
  source?: 'api' | 'cli' | 'mcp' | 'internal';
}
```

### Audit Sink

**Location:** [`packages/ai/src/telemetry/audit.ts:17-38`](packages/ai/src/telemetry/audit.ts:17)

```typescript
type AuditSink = (record: ToolAuditRecord) => Promise<void>;

// Default: File-backed in .data/ai-audit/
// Production: Replace with database sink via setAuditSink()
```

---

## 5. CLI Policy Enforcement

### Overview

CLI commands MUST NOT bypass policy gates. All tool execution goes through budget checks.

### Files

| File | Description |
|------|-------------|
| [`packages/cli/src/lib/tools.ts`](packages/cli/src/lib/tools.ts) | Tool registry with policy enforcement |
| [`packages/cli/src/lib/agent-runner.ts`](packages/cli/src/lib/agent-runner.ts) | Agent execution loop |

### Enforcement Points

1. **ToolRegistry.call()** - [`packages/cli/src/lib/tools.ts:320`](packages/cli/src/lib/tools.ts:320)
   - Budget check before execution
   - Audit logging for all decisions

2. **AgentRunner.executeTool()** - [`packages/cli/src/lib/agent-runner.ts:41`](packages/cli/src/lib/agent-runner.ts:41)
   - Depth enforcement
   - Context injection

### Budget Integration

**Location:** [`packages/cli/src/lib/tools.ts:140-175`](packages/cli/src/lib/tools.ts:140)

```typescript
// 4. Enforce Budget Limits (CLI cannot bypass policies)
const estimatedCost = tool.cost?.costCents ?? 0;
const budgetResult = await checkBudget(ctx.tenantId, estimatedCost);

// Log the policy decision
logCLIAudit(
  ctx.userId,
  ctx.tenantId,
  ctx.requestId,
  name,
  tool.version,
  budgetResult.allowed ? 'allow' : 'deny',
  budgetResult.reason
);

if (!budgetResult.allowed) {
  throw new RequiemError({
    code: ErrorCode.BUDGET_EXCEEDED,
    message: budgetResult.reason,
  });
}
```

---

## 6. Replay Divergence Detection

### Overview

Detects when actual execution outputs differ from cached replay outputs.

### Files

| File | Description |
|------|-------------|
| [`packages/ai/src/tools/divergence.ts`](packages/ai/src/tools/divergence.ts) | TypeScript divergence detection |
| [`packages/ai/src/tools/replay.ts`](packages/ai/src/tools/replay.ts) | Replay cache system |
| [`include/requiem/replay.hpp`](include/requiem/replay.hpp) | C++ replay implementation |

### Divergence Detection

**Location:** [`packages/ai/src/tools/divergence.ts:60-120`](packages/ai/src/tools/divergence.ts:60)

```typescript
function checkReplayDivergence(
  expected: unknown,
  actual: unknown,
  toolName: string,
  config: DivergenceConfig = DEFAULT_CONFIG
): DivergenceCheckResult
```

### Key Features

- Deep object comparison
- Configurable ignore fields (timestamps, etc.)
- Custom comparators for specific types
- Severity classification (warning vs critical)

---

## 7. Policy Guardrail Definitions

### Allow/Deny Rules

**Location:** Implicit in policy gate evaluation

#### Allow Rules

1. **Tenant-scoped tools**: Allowed if tenant has valid context
2. **Capability requirements**: Allowed if actor has required capabilities
3. **Budget available**: Allowed if estimated cost within limits
4. **Role requirements**: Allowed if role meets minimum (side-effect tools require MEMBER+)

#### Deny Rules

1. **Missing tenant context**: Tool requires tenant, but none provided
2. **Missing capabilities**: Actor lacks required capabilities
3. **Budget exceeded**: Projected cost exceeds limit
4. **VIEWER side-effect**: VIEWER role cannot execute side-effect tools
5. **Unconfigured tenant**: No budget configuration exists (fail-safe)

---

## 8. Error Codes

### Budget-Related Errors

**Location:** [`packages/cli/src/lib/errors.ts:63`](packages/cli/src/lib/errors.ts:63)

```typescript
// Rate limiting / Budget (1800-1899)
RATE_LIMITED = 'REQ_RATE_LIMITED',
BUDGET_EXCEEDED = 'REQ_BUDGET_EXCEEDED',
```

### HTTP Status Mapping

| Error Code | HTTP Status |
|------------|-------------|
| BUDGET_EXCEEDED | 429 Too Many Requests |
| FORBIDDEN | 403 Forbidden |
| UNAUTHORIZED | 401 Unauthorized |

---

## 9. Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REQUIEM_TENANT_ID` | Tenant ID for CLI | Required |
| `REQUIEM_API_KEY` | API key for authentication | Required |
| `REQUIEM_BUDGET_TIER` | Budget tier (free/enterprise) | free |

### Programmatic Configuration

```typescript
// Configure tenant budget
DefaultBudgetChecker.configureTenant(tenantId, 'enterprise', {
  maxCostCents: 100000,
  maxTokens: 1000000,
  windowSeconds: 2592000,
});

// Configure CLI budget tier
setCLIBudgetTier(tenantId, 'enterprise');

// Set custom audit sink (production)
setAuditSink(async (record) => {
  await db.auditLogs.insert(record);
});
```

---

## 10. Testing

### Unit Tests

- Budget checker: `packages/ai/src/policy/__tests__/budgets.test.ts`
- Policy gate: `packages/ai/src/policy/__tests__/gate.test.ts`
- Divergence: `packages/ai/src/tools/__tests__/divergence.test.ts`

### Integration Tests

- CLI policy enforcement: Verify budget limits are applied
- Audit logging: Verify all decisions are logged

---

## Appendix: File Reference Map

```
packages/ai/src/
├── policy/
│   ├── budgets.ts          # Budget enforcement (lines 53-385)
│   ├── capabilities.ts     # RBAC (lines 19-125)
│   └── gate.ts             # Policy gate (lines 1-95)
├── telemetry/
│   └── audit.ts            # Audit logging (lines 1-52)
├── tools/
│   ├── types.ts            # Audit record schema (lines 88-130)
│   ├── registry.ts         # Tool registry (lines 1-401)
│   ├── replay.ts           # Replay cache (lines 1-224)
│   └── divergence.ts       # Divergence detection (new)
└── types/
    └── index.ts            # TenantRole (lines 16-21)

packages/cli/src/
├── lib/
│   ├── tools.ts            # CLI budget + audit (lines 1-400)
│   ├── agent-runner.ts    # Execution loop (lines 1-114)
│   └── errors.ts          # Error codes (lines 15-71)
```

---

## Summary

| Layer | Default Behavior | Override |
|-------|------------------|----------|
| Budget | DENY (no config) | Configure via `DefaultBudgetChecker.configureTenant()` |
| RBAC | DENY (missing caps) | Add capabilities to role |
| Policy Gate | DENY (no gate) | Set via `setPolicyGate()` |
| Audit | File sink | Replace via `setAuditSink()` |

**Key Invariant**: All tool executions MUST pass through the policy gate. CLI cannot bypass budget enforcement.
