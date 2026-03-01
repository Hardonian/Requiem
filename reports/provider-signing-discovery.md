# Provider & Signing Discovery Report

## Executive Summary

This document maps the current architecture for:
1. **Provider Integration Points** - How LLM calls happen, model configuration, and policy hooks
2. **Artifact Units** - What's stored in CAS, SQLite metadata, manifest schemas

---

## Section A: Provider Integration Points

### A.1 Model Router (Primary Entry Point)

**File**: `packages/ai/src/models/router.ts`

- **Entry Function**: `routeModelCall(request: RouterRequest): Promise<RouterResponse>`
- **Gateway**: OpenRouter (`https://openrouter.ai/api/v1/chat/completions`)
- **Configuration Environment Variables**:
  - `OPENROUTER_API_KEY` - Required for API calls
  - `REQUIEM_MAX_TOKENS_PER_CALL` - Default: 4096
  - `REQUIEM_MAX_COST_CENTS_PER_CALL` - Default: 100 ($1.00)

**Key Features**:
- Token + cost ceiling enforcement
- Circuit breaker wrapping all provider calls
- Content-addressable caching for deterministic replay
- System prompt hash + tool registry hash stored per call
- Temperature-based determinism (0 = deterministic)

### A.2 Model Arbitrator

**File**: `packages/ai/src/models/arbitrator.ts`

- **Entry Function**: `generateText(request: ArbitratorRequest): Promise<GenerateTextResponse>`
- **Selection Logic**:
  1. If `preferredModel` specified and available → use it
  2. Find providers with preferred model
  3. Fall back to default model
  4. If circuit open for all options → throw `AiError.CIRCUIT_OPEN`

### A.3 Model Registry

**File**: `packages/ai/src/models/registry.ts`

**Built-in Models**:
| ID | Provider | Context Length | Input Cost/1M | Output Cost/1M |
|----|----------|----------------|---------------|----------------|
| claude-sonnet-4-6 | anthropic | 200K | 30¢ | 150¢ |
| claude-opus-4-6 | anthropic | 200K | 1500¢ | 7500¢ |
| claude-haiku-4-5-20251001 | anthropic | 200K | 5¢ | 25¢ |
| gpt-4o | openai | 128K | 50¢ | 150¢ |
| gpt-4o-mini | openai | 128K | 5¢ | 15¢ |

### A.4 Circuit Breaker

**File**: `packages/ai/src/models/circuitBreaker.ts`

- Tracks provider health per model
- Failure threshold: 5 failures in 60 seconds
- Recovery: 30 seconds after opening

### A.5 Policy Engine Hooks

**Files**: 
- `packages/ai/src/policy/gate.ts`
- `packages/ai/src/policy/budgets.ts`

**Policy Evaluation Flow**:
1. Tenant scoping check
2. RBAC capability check  
3. Side-effect restriction for VIEWER role
4. Guardrail evaluation
5. Budget check (async)

**Budget Enforcement**:
- Default: 1000¢ ($10) per month for free tier
- AtomicBudgetChecker for race-condition prevention

---

## Section B: Artifact Units

### B.1 Execution Envelope

**Produced by**: `packages/ai/src/tools/executor.ts`

```typescript
interface ExecutionEnvelope {
  result: unknown;                    // Tool output
  deterministic: boolean;             // Affects caching
  hash: string;                      // SHA-256: tool@version:inputHash:tenantId:mode
  duration_ms: number;               // Wall-clock execution time
  tool_version: string;              // Registered tool version
  tenant_id: string;                 // From invocation context
  request_id: string;                 // Trace ID
  from_cache: boolean;               // Served from replay cache?
}
```

**Hash Computation**:
```
executionHash = SHA256(toolName + "@" + version + ":" + inputHash + ":" + tenantId + ":" + mode)
```

### B.2 Memory Items (CAS-compatible)

**File**: `packages/ai/src/memory/store.ts`

```typescript
interface MemoryItem {
  id: string;                        // "mem_" + unique ID
  tenantId: string;                 // Tenant scoping
  contentHash: string;              // SHA-256 of normalized content
  content: unknown;                 // Redacted before storage
  metadata: MemoryItemMetadata;     // { source?, tags?, ... }
  createdAt: string;                // ISO timestamp
  vectorPointer?: string;           // Optional vector index reference
}
```

**Hash Computation**:
```typescript
contentHash = SHA256(normalizeForHashing(content))
// normalizeForHashing: sorts object keys, trims strings, stable JSON
```

### B.3 Replay Cache Entries

**File**: `packages/ai/src/memory/replayCache.ts`

```typescript
interface CachedToolResult {
  output: unknown;                   // Serialized result
  cachedAt: string;                  // ISO timestamp
  digest: string;                   // BLAKE3 hash of tool result
  latencyMs: number;                // Execution latency
}

interface ReplayCacheLookup {
  found: boolean;
  result?: CachedToolResult;
  stale?: boolean;                  // Digest changed since caching
  error?: AiError;
}
```

**Cache Key Format**: `tool:{name}:{inputHash}` (inputHash = BLAKE3.slice(0,16))

### B.4 Audit Records

**File**: `packages/ai/src/telemetry/audit.ts`

```typescript
interface ToolAuditRecord {
  timestamp: string;
  actorId: string;
  tenantId: string | null;
  traceId: string;
  toolName: string;
  toolVersion: string;
  inputHash?: string;               // SHA-256 of input (not full input)
  decision: 'allow' | 'deny';
  reason: string;
  policyRuleId?: string;
  budget?: {
    estimatedCostCents: number;
    limitCents: number;
    remainingCents: number;
    tier: string;
  };
  latencyMs: number | null;
  source?: 'api' | 'cli' | 'mcp' | 'internal';
}
```

**Merkle Chain Integration**: When `enable_merkle_audit_chain` flag is true, each record gets a `chain_hash` field.

### B.5 CAS Storage Structure

**Directory**: `{REQUIEM_DATA_DIR}/data/cas/objects/`

**File Layout**:
```
objects/
  {sha256[0:2]}/
    {sha256[2:]}         # 64-char hex filename (content)
    {sha256[2:]}.meta    # Optional metadata file
```

**CAS Consistency Check** (from `commands/doctor.ts`):
- Counts total objects
- Detects orphaned metadata files
- Reports total size

---

## Section C: Database Schema (SQLite)

### Core Tables

**decisions**:
- id, tenant_id, created_at, updated_at
- source_type, source_ref
- input_fingerprint (SHA-256)
- decision_input, decision_output, decision_trace
- usage, recommended_action_id, status
- outcome_status, outcome_notes, calibration_delta, execution_latency

**junctions**:
- id, tenant_id, created_at, updated_at
- junction_type, severity_score, fingerprint
- source_type, source_ref
- trigger_data, trigger_trace
- cooldown_until, deduplication_key, decision_report_id, status

**learning_signals**:
- id, tenant_id, run_id, category, metadata_json, created_at

**economic_events**:
- id, tenant_id, run_id, event_type, resource_units, cost_units, created_at

---

## Section D: CLI & Web Entry Points

### D.1 CLI Commands

| Command | File | Purpose |
|---------|------|---------|
| `doctor` | `commands/doctor.ts` | Health checks (CAS, DB, config) |
| `tool exec` | `commands/tool.ts` | Execute tools |
| `verify <hash>` | `commands/verify.ts` | Verify via replay |
| `replay run` | `commands/tool.ts` | Replay execution |

### D.2 Web API Routes

| Route | File | Purpose |
|-------|------|---------|
| `/api/cas/integrity` | `ready-layer/.../cas/integrity/route.ts` | CAS integrity check |
| `/api/replay/verify` | `ready-layer/.../replay/verify/route.ts` | Replay verification |

---

## Section E: Existing Determinism Guarantees

1. **Temperature 0**: When temperature is 0 and no JSON schema, calls are marked `replayable: true`
2. **Cache Key**: Computed from model + messages + systemPrompt + maxTokens
3. **Input Normalization**: Objects sorted by key, strings trimmed
4. **Tool Version Tracking**: `toolRegistryHash` stored per call for replay verification
5. **Digest Verification**: Cached results verified against current tool digest before reuse

---

## Section F: Key Interfaces to Extend

### For Provider Arbitration (NEW):
- `ArbitrationPolicy` - Cost/latency/quality constraints
- `ProviderRequest` - Tenant, run, step, input fingerprint, requirements
- `SelectionStrategy` - Deterministic selection algorithms

### For Artifact Signing (NEW):
- `ArtifactSignature` - Ed25519/BLAKE3 signature structure
- `ManifestSigning` - Sign run manifests with provenance
- `SignatureVerification` - Verify at read/serve/replay boundaries

---

*Generated: 2026-03-01*
*Mode: Provider Arbitration + Artifact Signing Discovery*
