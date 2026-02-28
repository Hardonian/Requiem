# Requiem Threat Model

> **Version:** 1.3.0  
> **Last Updated:** 2026-02-27  
> **Classification:** Internal

---

## Scope

This threat model covers:
- Requiem native execution engine (C++)
- CLI package (`@requiem/cli`)
- UI package (`@requiem/ui`)
- Ready-layer Next.js application
- Supporting infrastructure (CAS, database, queues)

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

**Threats:**
| ID | Threat | Severity | Mitigation |
|----|--------|----------|------------|
| API-1 | SQL Injection via query params | High | Parameterized queries, RLS |
| API-2 | IDOR (Insecure Direct Object Reference) | Critical | Tenant isolation, auth checks |
| API-3 | Rate limiting bypass | Medium | Token bucket per tenant |
| API-4 | DoS via expensive queries | Medium | Query timeouts, resource limits |
| API-5 | Information disclosure in errors | Medium | Structured error envelope |

### 2. CLI Package (`@requiem/cli`)

**Surface:**
- npm package distribution
- CLI commands (decide, junctions)
- Database connection handling

**Threats:**
| ID | Threat | Severity | Mitigation |
|----|--------|----------|------------|
| CLI-1 | Supply chain attack via dependencies | High | Locked versions, audit |
| CLI-2 | Credential exposure in logs | Critical | Secret redaction |
| CLI-3 | Path traversal in workspace paths | Medium | Path canonicalization |
| CLI-4 | Command injection | Medium | Input validation |

### 3. Native Engine (`src/`)

**Surface:**
- Binary execution
- File system access (CAS, workspace)
- Process spawning

**Threats:**
| ID | Threat | Severity | Mitigation |
|----|--------|----------|------------|
| ENG-1 | Sandbox escape | Critical | Process isolation, seccomp (future) |
| ENG-2 | Path traversal via workspace | High | Canonicalization, chroot |
| ENG-3 | Resource exhaustion | Medium | Timeouts, memory limits |
| ENG-4 | Hash collision attacks | Low | BLAKE3 (collision-resistant) |
| ENG-5 | Determinism violation | Critical | Clock abstraction, validation |

### 4. Database

**Surface:**
- Supabase PostgreSQL
- Prisma ORM queries
- RLS policies

**Threats:**
| ID | Threat | Severity | Mitigation |
|----|--------|----------|------------|
| DB-1 | Tenant isolation bypass | Critical | RLS policies, query validation |
| DB-2 | Privilege escalation | High | Least privilege, role separation |
| DB-3 | Connection string exposure | Critical | Secrets manager, no env vars |
| DB-4 | Unencrypted data at rest | Medium | Encryption enabled |

### 5. CAS Storage

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
   - Treatment: Defense in depth, process isolation

### High Risks

4. **IDOR** — Direct object reference without authorization
   - Impact: High
   - Likelihood: Medium
   - Treatment: Authorization checks on all endpoints

5. **CREDENTIAL-EXPOSURE** — Secrets in logs/errors
   - Impact: High
   - Likelihood: Medium
   - Treatment: Secret redaction, automated scanning

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

### Planned

| Control | Target | Priority |
|---------|--------|----------|
| Seccomp-BPF | Linux sandbox | High |
| Landlock LSM | Path restrictions | Medium |
| Network namespaces | Process isolation | Medium |
| eBPF monitoring | Runtime security | Low |

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

---

## Security Checklist

### New Endpoint Checklist

- [ ] Authentication required
- [ ] Authorization checks (tenant + role)
- [ ] Input validation (Zod schemas)
- [ ] Rate limiting applied
- [ ] Structured error responses
- [ ] No secrets in responses
- [ ] Audit log entry created
- [ ] Added to `verify_no_hard_500.sh`

### New Dependency Checklist

- [ ] Security audit (npm audit, Snyk)
- [ ] License compatibility check
- [ ] Added to `contracts/deps.allowlist.json`
- [ ] Pin to exact version
- [ ] No postinstall scripts (or reviewed)

### Release Security Checklist

- [ ] All CI gates pass
- [ ] `verify_secrets.sh` clean
- [ ] `verify_supply_chain.sh` clean
- [ ] No new high/critical vulnerabilities
- [ ] Security team sign-off (major releases)

---

## Compliance Mapping

| Requirement | Control | Evidence |
|-------------|---------|----------|
| **SOC 2 CC6.1** | Logical access security | RLS policies, auth checks |
| **SOC 2 CC6.6** | Security infrastructure | Tenant isolation, encryption |
| **SOC 2 CC7.2** | System monitoring | Audit logs, metrics |
| **GDPR 32** | Security of processing | Encryption, access controls |
| **ISO 27001 A.9** | Access control | Tenant isolation, roles |

---

## Review Schedule

- **Quarterly:** Full threat model review
- **Monthly:** Dependency vulnerability scan
- **Weekly:** Security gate in CI
- **Continuous:** Automated secret scanning

---

## References

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [OWASP Threat Modeling](https://owasp.org/www-community/Application_Threat_Modeling)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [INVARIANTS.md](./INVARIANTS.md)
- [OPERATIONS.md](./OPERATIONS.md)
