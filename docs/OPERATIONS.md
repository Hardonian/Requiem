# Requiem Operations Guide

> **Version:** 1.4.0  
> **Audience:** SREs, DevOps, Platform Engineers  
> **Last Updated:** 2026-03-01 (Phase 5 Documentation Finalization)

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
#   "version": "1.4.0",
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
#   "version": "1.4.0",
#   "timestamp": "2026-03-01T01:00:00Z",
#   "checks": {
#     "database": "ok",
#     "cas": "ok",
#     "engine": "ok",
#     "circuit_breaker": "ok",
#     "audit_persistence": "ok"
#   }
# }
```

### Health Check Criteria

| Component | Healthy | Degraded | Critical |
|-----------|---------|----------|----------|
| **Database** | <100ms latency | 100-500ms | >500ms or timeout |
| **CAS** | Read <50ms | 50-200ms | >200ms |
| **Engine** | Exec <1s | 1-5s | >5s or OOM |
| **Circuit Breaker** | Closed | Half-open | Open (failing) |
| **Audit Log** | Writing | Delayed >1s | Not writing |

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

**AI Package Migrations (Phase 4):**

```bash
# Run migrations via CLI
pnpm cli db:migrate

# Check migration status
pnpm cli db:status

# Rollback (if needed)
pnpm cli db:rollback --to <migration_id>
```

**Migration Runner Features:**
- Transactional migrations (all-or-nothing)
- Automatic rollback on failure
- Migration verification with checksums
- History tracking in `_migrations` table

**Pre-deployment Checklist:**
- [x] Migration tested on staging  
  *Validated: 2026-03-01 — All migrations tested*
- [x] Rollback script prepared  
  *Validated: 2026-03-01 — Rollback procedures documented*
- [x] No destructive changes without backup  
  *Validated: 2026-03-01 — Backup procedures verified*
- [x] Migration time < 30 seconds  
  *Validated: 2026-03-01 — All migrations under threshold*

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
git tag v1.4.0
git push origin v1.4.0
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

# Full verification
pnpm run verify:full
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
| **Circuit Breaker Opens** | >5/hour | >20/hour | Grafana: Requiem/Resilience |
| **Cost Anomaly Score** | >0.7 | >0.9 | Grafana: Requiem/Cost |
| **Audit Log Lag** | >1s | >5s | Grafana: Requiem/Audit |

### Logs

**Structure:**
```json
{
  "timestamp": "2026-03-01T01:00:00.000Z",
  "level": "error",
  "component": "engine",
  "phase": "execution",
  "tenantId": "tenant_uuid",
  "runId": "run_uuid",
  "traceId": "trace_uuid",
  "correlationId": "corr_uuid",
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

# Find circuit breaker events
{component="circuit_breaker"} |= "state_change"

# Find audit log entries
{component="audit"} | json
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

#### P1: Circuit Breaker Open

1. Check downstream service health
2. Review recent error patterns
3. Verify resource limits not exceeded
4. Manual reset if needed:
   ```bash
   pnpm cli circuit-breaker reset --service <name>
   ```

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
- JWT signing keys: 180 days

**Process:**
1. Generate new secret
2. Update secret store (Vault/AWS Secrets Manager)
3. Deploy with new secret reference
4. Revoke old secret after verification

**Automated Rotation (Phase 4):**
```bash
# Check rotation status
pnpm cli secrets:status

# Trigger rotation
pnpm cli secrets:rotate --type api_key

# Verify rotation
pnpm cli secrets:verify
```

### Access Review

**Monthly:**
- Review database access
- Review admin panel users
- Review SSH/key access to production

**Quarterly:**
- Full access audit
- Offboarding verification

---

## New Infrastructure Features (Phase 4)

### Persistent Circuit Breaker State

**Features:**
- Circuit breaker state persisted to database
- Cluster-wide coordination
- Automatic state recovery on restart
- Metrics and alerting integration

**Configuration:**
```json
{
  "circuit_breaker": {
    "failure_threshold": 5,
    "recovery_timeout_ms": 30000,
    "half_open_max_calls": 3,
    "persistence_enabled": true
  }
}
```

**Operations:**
```bash
# View circuit breaker status
pnpm cli circuit-breaker:status

# Reset a circuit breaker
pnpm cli circuit-breaker:reset --service <name>

# View history
pnpm cli circuit-breaker:history --service <name>
```

### Production Cost Sink

**Features:**
- Real-time cost tracking per tenant
- Cost anomaly detection with statistical modeling
- Budget enforcement with hard/soft limits
- Alerting on budget thresholds

**Configuration:**
```json
{
  "cost_sink": {
    "enabled": true,
    "flush_interval_ms": 60000,
    "anomaly_threshold": 0.95,
    "alert_channels": ["slack", "pagerduty"]
  }
}
```

**Monitoring:**
```bash
# View cost metrics
pnpm cli cost:metrics --tenant <id>

# Check anomaly scores
pnpm cli cost:anomalies --window 1h
```

### Database Migrations

**Migration Runner:**
- Located in `packages/ai/src/migrations/`
- Transactional with automatic rollback
- Version-controlled migration files
- Checksum verification

**Commands:**
```bash
# Run pending migrations
pnpm cli db:migrate

# Check status
pnpm cli db:status

# Create new migration
pnpm cli db:create --name <description>

# Rollback
pnpm cli db:rollback --to <version>
```

**Best Practices:**
1. Always test migrations on staging first
2. Keep migrations backward compatible when possible
3. Include rollback scripts for destructive changes
4. Monitor migration duration in production

### Credential Rotation

**Automated Workflow:**
1. Detection: System monitors credential age
2. Notification: Alerts 7 days before expiry
3. Generation: New credentials created automatically
4. Distribution: Credentials distributed to services
5. Verification: Health checks confirm new credentials work
6. Revocation: Old credentials revoked after grace period

**Rotation Policies:**
```json
{
  "credential_rotation": {
    "api_keys": { "ttl_days": 90, "grace_days": 7 },
    "db_credentials": { "ttl_days": 30, "grace_days": 3 },
    "tls_certs": { "ttl_days": 365, "grace_days": 30 },
    "jwt_keys": { "ttl_days": 180, "grace_days": 14 }
  }
}
```

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

### Database Connection Issues

```bash
# Check connection pool status
pnpm cli db:pool:status

# Check for connection leaks
pnpm cli db:pool:leaks

# Reset connection pool
pnpm cli db:pool:reset
```

### Circuit Breaker Issues

```bash
# View all circuit states
pnpm cli circuit-breaker:list

# Check specific service
pnpm cli circuit-breaker:status --service <name>

# Force reset (emergency only)
pnpm cli circuit-breaker:reset --service <name> --force
```

---

## References

- [OPERATIONS_RUNBOOK.md](./internal/OPERATIONS_RUNBOOK.md) — Detailed operational procedures
- [LAUNCH_GATE_CHECKLIST.md](./LAUNCH_GATE_CHECKLIST.md) — Pre-release verification
- [THREAT_MODEL.md](./THREAT_MODEL.md) — Security threat model
- [TROUBLESHOOTING.md](./troubleshooting.md) — Common issues and solutions
