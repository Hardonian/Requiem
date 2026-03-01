# Requiem Threat Model

> **Version:** 1.4.0  
> **Last Updated:** 2026-03-01  
> **Classification:** Internal

---

## Scope

This threat model covers:
- Requiem native execution engine (C++)
- CLI package (`@requiem/cli`)
- UI package (`@requiem/ui`)
- Ready-layer Next.js application
- Supporting infrastructure (CAS, database, queues)
- AI/MCP subsystem (`@requiem/ai`)

**Out of scope:**
- Physical infrastructure security (handled by cloud provider)
- Employee devices and access (covered by corporate security)
- Third-party SaaS integrations (separate assessments)

---

## Assets

| Asset | Value | Sensitivity | Owner |
|-------|-------|-------------|-------|
| **Customer code/executions** | Critical | High | Customers |
| **CAS objects** | Critical | High | Platform |
| **Tenant data** | High | Critical | Customers |
| **Audit logs** | High | High | Platform |
| **API keys/credentials** | Critical | Critical | Platform |
| **Determinism proofs** | High | Medium | Platform |
| **Source code** | Medium | Medium | Engineering |
| **MCP tool definitions** | High | High | Platform |

---

## Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                        UNTRUSTED ZONE                           │
│  (Internet, User Devices, Browser)                              │
├─────────────────────────────────────────────────────────────────┤
│  🔒 Trust Boundary 1: API Gateway / CDN                         │
├─────────────────────────────────────────────────────────────────┤
│                        DMZ                                      │
│  (Load Balancers, WAF, DDoS Protection)                         │
├─────────────────────────────────────────────────────────────────┤
│  🔒 Trust Boundary 2: Application Tier                          │
├─────────────────────────────────────────────────────────────────┤
│                        TRUSTED ZONE                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ ready-layer │  │  @requiem   │  │    Native Engine        │ │
│  │  (Next.js)  │  │    /cli     │  │    (C++ binary)         │ │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────────┘ │
│         │                │                                      │
│  ┌──────▼────────────────▼──────┐  ┌─────────────────────────┐ │
│  │      Database (Postgres)      │  │    CAS Storage          │ │
│  │      (RLS enforced)           │  │    (Immutable)          │ │
│  └───────────────────────────────┘  └─────────────────────────┘ │
│         │                                                         │
│  ┌──────▼─────────────────────────────────────────────────────┐ │
│  │              @requiem/ai (MCP + Policy)                     │ │
│  │   Policy Gate │ Budgets │ Circuit Breaker │ Audit Log      │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Threat Actors

| Actor | Motivation | Capability | Risk |
|-------|------------|------------|------|
| **Anonymous Attacker** | Financial gain, disruption | Low-Medium | Medium |
| **Malicious Customer** | Access other tenants' data | Medium | High |
| **Compromised Account** | Lateral movement, data exfil | Medium-High | High |
| **Insider Threat** | Sabotage, data theft | High | Medium |
| **Nation State** | IP theft, sabotage | Very High | Low |

---

## Attack Surface

### 1. API Endpoints (`ready-layer/src/app/api/`)

**Surface:**
- `/api/health` — Health checks
- `/api/audit/logs` — Audit log retrieval
- `/api/cas/integrity` — CAS integrity verification
- `/api/engine/*` — Engine operations
- `/api/cluster/*` — Cluster management
- `/api/replay/verify` — Replay validation
- `/api/vector/search` — Vector search
- `/api/mcp/*` — MCP tool operations

**Threats:**
| ID | Threat | Severity | Mitigation |
|----|--------|----------|------------|
| API-1 | SQL Injection via query params | High | Parameterized queries, RLS |
| API-2 | IDOR (Insecure Direct Object Reference) | Critical | Tenant isolation, auth checks |
| API-3 | Rate limiting bypass | Medium | Token bucket per tenant |
| API-4 | DoS via expensive queries | Medium | Query timeouts, resource limits |
| API-5 | Information disclosure in errors | Medium | Structured error envelope |
| API-6 | Prompt injection via MCP tools | High | Input sanitization filter |
| API-7 | JWT replay attacks | Medium | Short expiry, rotation |

### 2. CLI Package (`@requiem/cli`)

**Surface:**
- npm package distribution
- CLI commands (decide, junctions)
- Database connection handling
- Migration runner

**Threats:**
| ID | Threat | Severity | Mitigation |
|----|--------|----------|------------|
| CLI-1 | Supply chain attack via dependencies | High | Locked versions, audit |
| CLI-2 | Credential exposure in logs | Critical | Secret redaction |
| CLI-3 | Path traversal in workspace paths | Medium | Path canonicalization |
| CLI-4 | Command injection | Medium | Input validation |
| CLI-5 | Migration tampering | High | Checksum verification |

### 3. Native Engine (`src/`)

**Surface:**
- Binary execution
- File system access (CAS, workspace)
- Process spawning
- Seccomp-BPF

**Threats:**
| ID | Threat | Severity | Mitigation |
|----|--------|----------|------------|
| ENG-1 | Sandbox escape | Critical | Seccomp-BPF, namespaces |
| ENG-2 | Path traversal via workspace | High | Canonicalization, chroot |
| ENG-3 | Resource exhaustion | Medium | Timeouts, memory limits |
| ENG-4 | Hash collision attacks | Low | BLAKE3 (collision-resistant) |
| ENG-5 | Determinism violation | Critical | Clock abstraction, validation |
| ENG-6 | Seccomp filter bypass | High | Careful syscall allowlisting |

### 4. AI/MCP Subsystem (`packages/ai/`)

**Surface:**
- MCP tool registration
- Policy enforcement
- Budget tracking
- Circuit breaker
- Audit logging

**Threats:**
| ID | Threat | Severity | Mitigation |
|----|--------|----------|------------|
| AI-1 | Tool output DoS | High | Output limits enforced |
| AI-2 | Budget bypass | Critical | DB-backed budgets |
| AI-3 | Prompt injection | High | Input filter, correlation IDs |
| AI-4 | Policy evasion | Critical | Policy at MCP entry |
| AI-5 | Audit log tampering | High | Merkle chain, append-only |

### 5. Database

**Surface:**
- Supabase PostgreSQL
- Prisma ORM queries
- RLS policies
- Migration runner

**Threats:**
| ID | Threat | Severity | Mitigation |
|----|--------|----------|------------|
| DB-1 | Tenant isolation bypass | Critical | RLS policies, query validation |
| DB-2 | Privilege escalation | High | Least privilege, role separation |
| DB-3 | Connection string exposure | Critical | Secrets manager, no env vars |
| DB-4 | Unencrypted data at rest | Medium | Encryption enabled |
| DB-5 | Migration injection | High | Checksum verification |

### 6. CAS Storage

**Surface:**
- File system objects
- Metadata files
- Digest-based addressing

**Threats:**
| ID | Threat | Severity | Mitigation |
|----|--------|----------|------------|
| CAS-1 | Object tampering | Critical | Hash-on-read, immutability |
| CAS-2 | Storage exhaustion | Medium | Quotas, garbage collection |
| CAS-3 | Information leakage | Low | No sensitive data in CAS |

---

## Risk Matrix

| Likelihood \ Impact | Low | Medium | High | Critical |
|---------------------|-----|--------|------|----------|
| **High** | Low | Medium | High | Critical |
| **Medium** | Low | Medium | High | High |
| **Low** | Low | Low | Medium | Medium |
| **Very Low** | Low | Low | Low | Low |

### Critical Risks

1. **TENANT-ISOLATION-BYPASS** — Cross-tenant data access
   - Impact: Critical
   - Likelihood: Low (with current controls)
   - Treatment: Continuous monitoring, red-team testing

2. **DETERMINISM-VIOLATION** — Replay fails due to non-determinism
   - Impact: Critical (trust erosion)
   - Likelihood: Low
   - Treatment: CI gates, runtime validation

3. **SANDBOX-ESCAPE** — Executed code escapes isolation
   - Impact: Critical
   - Likelihood: Low
   - Treatment: Defense in depth, seccomp-BPF

4. **PROMPT-INJECTION** — Malicious input via MCP tools
   - Impact: Critical
   - Likelihood: Medium
   - Treatment: Input filter, correlation IDs

### High Risks

5. **IDOR** — Direct object reference without authorization
   - Impact: High
   - Likelihood: Medium
   - Treatment: Authorization checks on all endpoints

6. **CREDENTIAL-EXPOSURE** — Secrets in logs/errors
   - Impact: High
   - Likelihood: Medium
   - Treatment: Secret redaction, automated scanning

7. **BUDGET-BYPASS** — Cost/quota enforcement bypass
   - Impact: High
   - Likelihood: Low
   - Treatment: DB-backed budgets with persistence

---

## Mitigations

### Implemented

| Control | Coverage | Verification |
|---------|----------|--------------|
| RLS policies | Database queries | `verify_tenant_isolation.sh` |
| Structured errors | API responses | `verify_no_hard_500.sh` |
| Input validation | All endpoints | TypeScript strict mode |
| Path canonicalization | File operations | Unit tests |
| Hash verification | CAS reads | `verify_cas.sh` |
| Rate limiting | API tier | Middleware |
| Audit logging | All operations | `verify_enterprise_boundaries.sh` |
| Clock abstraction | Core logic | `verify_provenance.sh` |
| JWT validation | MCP transport | `verify:mcp` tests |
| Seccomp-BPF | Linux sandbox | Capability truth |
| Prompt injection filter | MCP input | `verify:ai-safety` tests |
| DB-backed budgets | Cost control | `verify:cost-accounting` |
| Merkle audit chain | Audit integrity | `requiem audit verify` |
| Circuit breaker | Resilience | `verify:tenant-isolation` |
| Correlation IDs | Request tracing | Middleware |
| Credential rotation | Secret management | Automated workflow |

### Planned

| Control | Target | Priority |
|---------|--------|----------|
| Landlock LSM | Path restrictions | Medium |
| Network namespaces | Process isolation | Medium |
| eBPF monitoring | Runtime security | Low |

---

## Completed Mitigations (Phase 1-4)

### Phase 1A: JWT Validation & MCP Security
- ✅ JWT token validation at MCP transport layer
- ✅ Token expiry and claims verification
- ✅ Correlation ID generation for cross-request tracing
- ✅ Request attribution and audit trail

### Phase 1B: Seccomp, Signed Bundles & Audit
- ✅ Seccomp-BPF syscall filtering
- ✅ Signed provenance bundles with Merkle roots
- ✅ Audit persistence with Merkle chain
- ✅ Capability truth reporting
- ✅ Windows restricted tokens

### Phase 2A: DB-Backed Budgets & Cost Control
- ✅ Persistent budget tracking per tenant
- ✅ Cross-instance budget coordination
- ✅ Cost anomaly detection with statistical modeling
- ✅ Budget enforcement at policy gate

### Phase 2B: Tool Registry Security
- ✅ Tool output limits enforced at registry
- ✅ Flag-based capability controls
- ✅ Replay cache for determinism
- ✅ Tool execution sandboxing

### Phase 3A: MCP Policy Enforcement
- ✅ Policy enforcement at MCP entry point
- ✅ Prompt injection filter with pattern detection
- ✅ Correlation ID propagation
- ✅ Input sanitization and validation

### Phase 4: Infrastructure Security
- ✅ Circuit breaker persistence to database
- ✅ Database migration runner with verification
- ✅ Automated credential rotation workflow
- ✅ Production cost sink with anomaly detection

---

## Attack Scenarios

### Scenario 1: Cross-Tenant Data Access

**Attacker:** Malicious customer with valid credentials  
**Goal:** Access other tenants' execution data  

**Attack Path:**
1. Intercept API request to `/api/engine/status`
2. Modify `tenant_id` parameter in request body
3. Observe if data from other tenant is returned

**Defenses:**
- Server-side tenant resolution (ignores client `tenant_id`)
- RLS policies enforce `WHERE tenant_id = current_setting('app.current_tenant')`
- All queries filtered by authenticated tenant context

**Verification:**
```bash
./scripts/verify_tenant_isolation.sh
```

### Scenario 2: Determinism Violation

**Attacker:** Compromised insider  
**Goal:** Corrupt execution results undetectably  

**Attack Path:**
1. Modify engine to use wall clock time
2. Submit execution request
3. Result appears valid but won't replay correctly

**Defenses:**
- Clock abstraction prevents direct time access
- Replay verification recomputes and compares
- Golden corpus tests detect changes
- Merkle audit chain detects tampering

**Verification:**
```bash
./scripts/verify_determinism.sh
./scripts/verify_provenance.sh
```

### Scenario 3: CAS Tampering

**Attacker:** External with storage access  
**Goal:** Modify stored execution artifacts  

**Attack Path:**
1. Gain access to CAS storage (e.g., via cloud credential leak)
2. Modify object at `.cas/v2/objects/AB/CD/ABCDEF...`
3. Wait for retrieval

**Defenses:**
- Hash-on-read verification
- Content-addressed (modification changes digest)
- Immutability enforcement at filesystem level

**Verification:**
```bash
./scripts/verify_cas.sh
```

### Scenario 4: Prompt Injection

**Attacker:** Malicious user via MCP tool  
**Goal:** Execute unauthorized commands via tool input  

**Attack Path:**
1. Craft input with injection patterns
2. Submit via MCP tool execution
3. Attempt to bypass input validation

**Defenses:**
- Prompt injection filter with pattern detection
- Input sanitization at MCP entry
- Correlation IDs for request attribution
- Audit logging of all inputs

**Verification:**
```bash
pnpm run verify:ai-safety
```

---

## Security Checklist

### New Endpoint Checklist

- [x] Authentication required  
  *Validated: 2026-03-01 — All endpoints require auth*
- [x] Authorization checks (tenant + role)  
  *Validated: 2026-03-01 — RLS + server-side checks*
- [x] Input validation (Zod schemas)  
  *Validated: 2026-03-01 — All inputs validated*
- [x] Rate limiting applied  
  *Validated: 2026-03-01 — Token bucket per tenant*
- [x] Structured error responses  
  *Validated: 2026-03-01 — No hard-500s*
- [x] No secrets in responses  
  *Validated: 2026-03-01 — Secret redaction active*
- [x] Audit log entry created  
  *Validated: 2026-03-01 — All operations logged*
- [x] Added to `verify_no_hard_500.sh`  
  *Validated: 2026-03-01 — Verification coverage complete*

### New Dependency Checklist

- [x] Security audit (npm audit, Snyk)  
  *Validated: 2026-03-01 — No high/critical vulnerabilities*
- [x] License compatibility check  
  *Validated: 2026-03-01 — All licenses compatible*
- [x] Added to `contracts/deps.allowlist.json`  
  *Validated: 2026-03-01 — Dependencies allowlisted*
- [x] Pin to exact version  
  *Validated: 2026-03-01 — Exact versions pinned*
- [x] No postinstall scripts (or reviewed)  
  *Validated: 2026-03-01 — Postinstall scripts reviewed*

### Release Security Checklist

- [x] All CI gates pass  
  *Validated: 2026-03-01 — verify:full passes*
- [x] `verify_secrets.sh` clean  
  *Validated: 2026-03-01 — No secrets detected*
- [x] `verify_supply_chain.sh` clean  
  *Validated: 2026-03-01 — Supply chain verified*
- [x] No new high/critical vulnerabilities  
  *Validated: 2026-03-01 — Audit clean*
- [x] Security team sign-off (major releases)  
  *Validated: 2026-03-01 — Security review complete*

---

## Compliance Mapping

| Requirement | Control | Evidence |
|-------------|---------|----------|
| **SOC 2 CC6.1** | Logical access security | RLS policies, auth checks |
| **SOC 2 CC6.6** | Security infrastructure | Tenant isolation, encryption |
| **SOC 2 CC7.2** | System monitoring | Audit logs, metrics |
| **GDPR 32** | Security of processing | Encryption, access controls |
| **ISO 27001 A.9** | Access control | Tenant isolation, roles |
| **ISO 27001 A.12** | Malware protection | Seccomp-BPF, sandboxing |

---

## Review Schedule

- **Quarterly:** Full threat model review
- **Monthly:** Dependency vulnerability scan
- **Weekly:** Security gate in CI
- **Continuous:** Automated secret scanning
- **On Release:** Security checklist completion

---

## References

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [OWASP Threat Modeling](https://owasp.org/www-community/Application_Threat_Modeling)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [INVARIANTS.md](./INVARIANTS.md)
- [OPERATIONS.md](./OPERATIONS.md)
- [SECURITY.md](./SECURITY.md)
- [MCP_SECURITY_REVIEW.md](./MCP_SECURITY_REVIEW.md)
