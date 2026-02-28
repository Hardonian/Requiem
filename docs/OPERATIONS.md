# Requiem Operations Guide

> **Version:** 1.3.0  
> **Audience:** SREs, DevOps, Platform Engineers

---

## Environments

### Development

```bash
# Clone and setup
git clone https://github.com/reachhq/requiem.git
cd requiem
pnpm install

# Build native engine
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j

# Run tests
npm run verify
```

### Staging

- **Purpose:** Pre-production validation
- **Data:** Synthetic, refreshed nightly
- **Access:** Team leads, QA
- **URL:** `https://staging.ready-layer.com`

### Production

- **Access:** SSO + MFA required
- **Data:** Customer data, encrypted at rest
- **Regions:** us-east-1, eu-west-1
- **URL:** `https://ready-layer.com`

---

## Health Checks

### Native Engine Health

```bash
# CLI health check
./build/requiem version

# Expected output:
# {
#   "version": "1.3.0",
#   "engine_abi_version": 2,
#   "hash_algorithm_version": 1,
#   "cas_format_version": 2,
#   "protocol_framing_version": 1
# }
```

### API Health

```bash
# HTTP health endpoint
curl https://ready-layer.com/api/health

# Expected output:
# {
#   "status": "healthy",
#   "version": "1.3.0",
#   "timestamp": "2026-02-27T21:00:00Z",
#   "checks": {
#     "database": "ok",
#     "cas": "ok",
#     "engine": "ok"
#   }
# }
```

### Health Check Criteria

| Component | Healthy | Degraded | Critical |
|-----------|---------|----------|----------|
| **Database** | <100ms latency | 100-500ms | >500ms or timeout |
| **CAS** | Read <50ms | 50-200ms | >200ms |
| **Engine** | Exec <1s | 1-5s | >5s or OOM |

---

## Migrations

### Database Migrations

**Prisma (ready-layer):**

```bash
cd ready-layer

# Generate migration
npx prisma migrate dev --name <description>

# Apply in production
npx prisma migrate deploy

# Verify
npx prisma migrate status
```

**Pre-deployment Checklist:**
- [ ] Migration tested on staging
- [ ] Rollback script prepared
- [ ] No destructive changes without backup
- [ ] Migration time < 30 seconds

### CAS Format Migrations

**Process:**
1. Bump `CAS_FORMAT_VERSION` in `include/requiem/version.hpp`
2. Implement dual-read (old + new format)
3. Deploy with write-new, read-both
4. Backfill existing objects
5. Switch to read-new only
6. Remove old format code

**Verification:**
```bash
./scripts/verify_cas.sh
./scripts/verify_drift.sh
```

---

## Deployment

### Native Engine

```bash
# Build release
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j

# Run verification
./scripts/verify_determinism.sh
./scripts/verify_smoke.sh

# Deploy (via CI/CD)
git tag v1.3.0
git push origin v1.3.0
```

### TypeScript Packages

```bash
# Version bump
npm version patch  # or minor, major

# Build
npm run build

# Publish
npm publish
```

### Verification Suite

Run before any deployment:

```bash
# Root workspace
./scripts/verify-root.sh

# Boundaries
./scripts/verify-boundaries.sh

# Tenant isolation (smoke)
./scripts/verify-tenant-isolation.sh

# No hard-500
./scripts/verify-no-hard-500.sh

# Secrets scan
./scripts/verify-secrets.sh

# Supply chain
./scripts/verify-supply-chain.sh

# Determinism (if engine changed)
./scripts/verify_determinism.sh
```

---

## Monitoring

### Key Metrics

| Metric | Warning | Critical | Dashboard |
|--------|---------|----------|-----------|
| **Request Latency (p99)** | >500ms | >1s | Grafana: Requiem/API |
| **Error Rate** | >0.1% | >1% | Grafana: Requiem/Errors |
| **Engine OOM** | >10/hour | >50/hour | Datadog: Infra |
| **CAS Integrity Failures** | >0 | >0 | PagerDuty: P1 |
| **Determinism Violations** | >0 | >0 | PagerDuty: P0 |

### Logs

**Structure:**
```json
{
  "timestamp": "2026-02-27T21:00:00.000Z",
  "level": "error",
  "component": "engine",
  "phase": "execution",
  "tenantId": "tenant_uuid",
  "runId": "run_uuid",
  "traceId": "trace_uuid",
  "message": "Execution failed",
  "error": {
    "code": "REQ_ENGINE_EXECUTION_FAILED",
    "retryable": false
  }
}
```

**Search Examples:**
```bash
# Find errors by tenant
{component="api"} |= "tenantId" | json | tenantId="tenant_uuid"

# Find determinism violations
{component="engine"} |= "DETERMINISM_VIOLATION"

# Find slow queries
{component="db"} | json | duration_ms > 1000
```

---

## Incident Response

### Severity Levels

| Level | Definition | Response Time | Examples |
|-------|------------|---------------|----------|
| **P0** | Complete outage, data loss | 15 min | All regions down, CAS corruption |
| **P1** | Major degradation | 30 min | Single region down, high error rate |
| **P2** | Minor degradation | 2 hours | Elevated latency, partial feature failure |
| **P3** | Cosmetic issues | 24 hours | UI glitches, doc errors |

### Runbooks

#### P0: Determinism Violation Detected

1. **Immediate:** Stop all new executions
   ```bash
   # Set feature flag
   curl -X POST /api/admin/flags/execution_pause -d '{"value": true}'
   ```

2. **Investigate:** Check recent deployments
   ```bash
   git log --since="24 hours ago" --oneline
   ```

3. **Correlate:** Find offending change
   - Check hash algorithm changes
   - Check environment variable access
   - Check clock/time usage

4. **Mitigate:** Rollback if needed
   ```bash
   git revert <commit>
   git push origin main
   ```

5. **Verify:** Run determinism suite
   ```bash
   ./scripts/verify_determinism.sh
   ```

6. **Communicate:** Post to #incidents channel

#### P1: Database Connectivity Issues

1. Check connection pool metrics
2. Verify credentials haven't expired
3. Check for connection leaks in application
4. Consider connection pool scaling
5. Fail over to read replica if available

#### P2: Elevated CAS Read Latency

1. Check storage I/O metrics
2. Verify cache hit rate
3. Consider cache warming
4. Check for hot keys

### Escalation

1. **On-call engineer** responds (15 min SLA for P0)
2. **Team lead** notified after 15 min unresolved
3. **Engineering manager** notified after 30 min unresolved
4. **CTO** notified after 1 hour unresolved

---

## Backup and Recovery

### CAS Storage

- **Backup:** Daily snapshots to S3/GCS
- **Retention:** 30 days
- **RPO:** 24 hours
- **RTO:** 4 hours

**Recovery:**
```bash
# Restore from backup
aws s3 sync s3://backups/requiem-cas/$(date +%Y%m%d) /data/cas/

# Verify integrity
./scripts/verify_cas.sh
```

### Database

- **Backup:** Continuous point-in-time
- **Retention:** 7 days PITR, 30 days snapshots
- **RPO:** 5 minutes
- **RTO:** 1 hour

---

## Security Operations

### Secret Rotation

**Schedule:**
- API keys: 90 days
- Database credentials: 30 days
- TLS certificates: 365 days

**Process:**
1. Generate new secret
2. Update secret store (Vault/AWS Secrets Manager)
3. Deploy with new secret reference
4. Revoke old secret after verification

### Access Review

**Monthly:**
- Review database access
- Review admin panel users
- Review SSH/key access to production

**Quarterly:**
- Full access audit
- Offboarding verification

---

## Troubleshooting

### Engine Won't Start

```bash
# Check binary
./build/requiem version

# Check libraries
ldd ./build/requiem  # Linux
otool -L ./build/requiem  # macOS

# Run diagnostics
./build/requiem doctor
```

### Slow Execution

```bash
# Check resource limits
ulimit -a

# Profile execution
./scripts/verify_bench.sh

# Check for resource contention
./scripts/verify_stress.sh
```

### High Memory Usage

```bash
# Check CAS cache size
du -sh .cas/v2/objects

# Check for memory leaks
./scripts/verify_memory.sh
```

---

## Contact

| Role | Contact | PagerDuty |
|------|---------|-----------|
| On-call SRE | sre@reachhq.com | PagerDuty: Requiem-Primary |
| Security | security@reachhq.com | PagerDuty: Security-OnCall |
| Engineering Lead | eng-leads@reachhq.com | - |

---

## References

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System architecture
- [INVARIANTS.md](./INVARIANTS.md) — Hard constraints
- [THREAT_MODEL.md](./THREAT_MODEL.md) — Security analysis
- [SECURITY.md](../SECURITY.md) — Security policy
