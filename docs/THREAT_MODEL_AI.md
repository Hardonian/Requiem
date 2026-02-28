# Threat Model — AI Control-Plane

_Version: 0.1.0 | Updated: 2026-02-28_

## Assets

| Asset | Sensitivity | Location |
|-------|-------------|----------|
| Tool handlers | HIGH — execute code | packages/ai/src/tools/ |
| Tenant context | HIGH — identity | InvocationContext.tenant |
| Cost records | MEDIUM — financial data | .data/ai-cost/ or DB |
| Memory items | MEDIUM — may contain PII | .data/ai-memory/ or DB |
| Model API keys | CRITICAL | process.env.ANTHROPIC_API_KEY |
| Audit logs | HIGH — non-repudiation | .data/ai-audit/ or DB |

## Threat Actors

1. **Unauthenticated external attacker** — calls MCP endpoints without auth
2. **Authenticated tenant user** — attempts cross-tenant data access
3. **Compromised agent prompt** — prompt injection via LLM output
4. **Malicious tool input** — injection via tool arguments
5. **Admin insider** — bypasses policy gate

## Threats and Mitigations

### T1: Unauthorized Tool Invocation
- **Threat**: Caller invokes tool without valid auth/role
- **Mitigation**: Policy gate in `packages/ai/src/policy/gate.ts` enforces capabilities
- **Test**: `verify-ai-safety.ts` — Tests 1, 2, 3

### T2: Cross-Tenant Data Leakage
- **Threat**: Tenant A reads memory/cost data belonging to Tenant B
- **Mitigation**: All stores are keyed by tenantId; tenant derived server-side only
- **Test**: `verify-tenant-isolation.ts` — Tests 1, 2, 4

### T3: Server-Side Request Forgery via Tool
- **Threat**: Attacker crafts tool input to make server call attacker-controlled URL
- **Mitigation**: Tool handlers must be reviewed; provider adapters whitelist API endpoints
- **Status**: Partial — tool handler review process not yet formalized

### T4: Secret Leakage via Error Messages
- **Threat**: Stack traces or internal errors expose secrets to API callers
- **Mitigation**: `AiError.toSafeJson()` strips stack traces and cause chains
- **Test**: `verify-ai-safety.ts` — Test 6

### T5: Budget Exhaustion (DoS via Cost)
- **Threat**: Attacker calls expensive LLM tools in a loop
- **Mitigation**: `BudgetChecker` interface (stub now); circuit breaker for provider failures
- **Status**: Interface only — must implement real budget limits for production

### T6: Prompt Injection via Memory
- **Threat**: Adversarial content stored in memory gets injected into LLM prompts
- **Mitigation**: `redactObject()` applied before storage; content hashed for deduplication
- **Status**: Basic mitigation — output filtering of LLM responses not yet implemented

### T7: API Key Exposure
- **Threat**: ANTHROPIC_API_KEY or OPENAI_API_KEY leaked in logs/errors
- **Mitigation**: Keys read only in provider constructors; `redactString()` covers leak patterns
- **Status**: Pattern-based redaction covers common cases

### T8: Tenant ID Spoofing via Request Body
- **Threat**: Caller passes their own tenant_id in request body
- **Mitigation**: INVARIANT — tenant_id ALWAYS derived from validated auth token (never from body)
- **Status**: Enforced in `transport-next.ts`; tested in verify scripts

### T9: Schema Manipulation
- **Threat**: Attacker sends malformed input to bypass tool logic
- **Mitigation**: `validateInputOrThrow()` runs before every handler; `validateOutputOrThrow()` after
- **Test**: `verify-ai-safety.ts` — Test 5; `verify-mcp.ts` — Test 6

### T10: Circuit Breaker Bypass
- **Threat**: Attacker forces circuit open by causing provider failures, then bypasses check
- **Mitigation**: Circuit state is server-side only; clients cannot reset circuits
- **Status**: In-memory circuit state; persistent circuit state for prod recommended

## Risk Matrix

| Threat | Likelihood | Impact | Priority |
|--------|------------|--------|----------|
| T5 Budget Exhaustion | HIGH (no limits) | HIGH | P0 — Implement before prod |
| T3 SSRF via Tool | MEDIUM | HIGH | P1 |
| T6 Prompt Injection | MEDIUM | MEDIUM | P1 |
| T1 Unauth Invocation | LOW (auth gate) | HIGH | P2 |
| T2 Cross-Tenant | LOW (isolation enforced) | CRITICAL | P2 |
| T4 Secret Leak | LOW (safe errors) | HIGH | P2 |
| T7 API Key Exposure | LOW (env only) | CRITICAL | P2 |

## Pre-Production Checklist

- [ ] Implement real JWT validation in `transport-next.ts`
- [ ] Implement `BudgetChecker` with DB-backed limits
- [ ] Add RLS policies to `ai_cost_records` and memory tables
- [ ] Formalize tool handler review process
- [ ] Add rate limiting at the MCP transport layer
- [ ] Enable audit log persistence to DB
- [ ] Add LLM output filtering for prompt injection
