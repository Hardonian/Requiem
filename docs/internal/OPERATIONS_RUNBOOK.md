# Requiem Operations Runbook

> **Version:** 1.0.0  
> **Last Updated:** 2026-03-01  
> **Audience:** SREs, DevOps, Platform Engineers  
> **Classification:** Internal

---

## Table of Contents

1. [Startup Procedures](#startup-procedures)
2. [Shutdown Procedures](#shutdown-procedures)
3. [Monitoring](#monitoring)
4. [Incident Response](#incident-response)
5. [Credential Rotation](#credential-rotation)
6. [Database Migrations](#database-migrations)
7. [Security Incident Response](#security-incident-response)

---

## Startup Procedures

### Pre-Startup Checklist

Before starting any Requiem service:

```bash
# 1. Verify environment
node --version  # Should be 20.x
pnpm --version  # Should be 8.x

# 2. Check environment variables
pnpm cli env:verify

# 3. Verify database connectivity
pnpm cli db:ping

# 4. Check CAS storage
requiem cas verify --sample 100

# 5. Verify native engine
./build/requiem doctor
```

### Service Startup Order

```
1. Database (PostgreSQL)
   └── Verify: pnpm cli db:ping
   
2. CAS Storage
   └── Verify: requiem cas verify --sample 100
   
3. Native Engine
   └── Verify: ./build/requiem doctor
   
4. AI/MCP Layer
   └── Verify: pnpm run verify:mcp
   
5. API Layer (ready-layer)
   └── Verify: curl /api/health
   
6. CLI Services
   └── Verify: pnpm cli status
```

### Startup Verification Commands

```bash
# Full system verification
pnpm run verify:full

# Individual component checks
pnpm cli db:status          # Database
requiem cas stats           # CAS
./build/requiem health      # Native engine
pnpm run verify:mcp         # MCP layer
curl /api/health            # API layer
```

### Startup Troubleshooting

**Database Connection Failed:**
```bash
# Check connection string
echo $DATABASE_URL

# Test direct connection
psql $DATABASE_URL -c "SELECT 1"

# Check connection pool
pnpm cli db:pool:status
```

**CAS Storage Unavailable:**
```bash
# Check mount point
df -h /data/cas

# Verify permissions
ls -la /data/cas/v2/objects

# Check for corruption
requiem cas verify --all
```

**Native Engine Won't Start:**
```bash
# Check binary integrity
./build/requiem version

# Check shared libraries
ldd ./build/requiem

# Run diagnostics
./build/requiem doctor
```

---

## Shutdown Procedures

### Graceful Shutdown

```bash
# 1. Stop accepting new requests
curl -X POST /api/admin/flags/execution_pause -d '{"value": true}'

# 2. Wait for in-flight requests to complete
# Monitor: watch 'curl /api/metrics | grep active_requests'

# 3. Flush audit logs
pnpm cli audit:flush

# 4. Save circuit breaker state
pnpm cli circuit-breaker:save

# 5. Close database connections
pnpm cli db:pool:drain

# 6. Stop services
# (Use systemd/docker stop)
```

### Emergency Shutdown

```bash
# Immediate stop (may lose in-flight requests)
pkill -TERM requiem

# Force kill (last resort)
pkill -KILL requiem
```

### Post-Shutdown Verification

```bash
# Verify no processes running
ps aux | grep requiem

# Check for orphaned connections
pnpm cli db:locks

# Verify audit log integrity
pnpm cli audit:verify
```

### Audit Log Flush

```bash
# Flush pending audit entries
pnpm cli audit:flush

# Verify flush completion
pnpm cli audit:status

# Check for unflushed entries
pnpm cli audit:pending
```

### Circuit Breaker State Save

```bash
# Save state to database
pnpm cli circuit-breaker:save

# Verify saved state
pnpm cli circuit-breaker:status

# Export for backup
pnpm cli circuit-breaker:export > /backup/cb_$(date +%Y%m%d).json
```

---

## Monitoring

### Key Metrics Dashboard

**Grafana Dashboards:**

| Dashboard | URL | Purpose |
|-----------|-----|---------|
| Requiem/API | `/grafana/d/requiem-api` | Request latency, error rates |
| Requiem/Engine | `/grafana/d/requiem-engine` | Execution metrics |
| Requiem/CAS | `/grafana/d/requiem-cas` | Storage metrics |
| Requiem/Audit | `/grafana/d/requiem-audit` | Audit log health |
| Requiem/Cost | `/grafana/d/requiem-cost` | Cost and budgets |
| Requiem/Resilience | `/grafana/d/requiem-resilience` | Circuit breakers |

### Critical Alerts

**P0 Alerts (Page immediately):**
- Determinism violation detected
- CAS integrity failure
- Database connectivity loss
- All regions down

**P1 Alerts (Respond within 30 min):**
- Error rate >1%
- P99 latency >1s
- Circuit breaker open
- Single region down

**P2 Alerts (Respond within 2 hours):**
- Error rate >0.1%
- P99 latency >500ms
- Elevated cost anomaly score
- Audit log lag >1s

### Alert Routing

```yaml
# PagerDuty routing
P0:
  - sms
  - phone
  - email
  
P1:
  - phone
  - email
  
P2:
  - email
  - slack

# Slack channels
- #alerts-p0 (P0 only)
- #alerts-p1 (P0, P1)
- #alerts-info (all alerts)
```

### Custom Metrics Queries

**Prometheus:**
```promql
# Request rate
rate(requiem_requests_total[5m])

# Error rate
rate(requiem_errors_total[5m]) / rate(requiem_requests_total[5m])

# P99 latency
histogram_quantile(0.99, rate(requiem_request_duration_bucket[5m]))

# Circuit breaker state
requiem_circuit_breaker_state

# Cost per tenant
sum by (tenant_id) (requiem_cost_total)
```

**Datadog:**
```
# Engine OOM rate
sum:requiem.engine.oom{*}.as_rate()

# CAS read latency
avg:requiem.cas.read_latency{*}
```

---

## Incident Response

### Incident Classification

| Severity | Definition | Examples | Response Time |
|----------|------------|----------|---------------|
| **P0** | Complete outage, data loss | All regions down, CAS corruption | 15 min |
| **P1** | Major degradation | Single region down, high error rate | 30 min |
| **P2** | Minor degradation | Elevated latency, partial feature failure | 2 hours |
| **P3** | Cosmetic issues | UI glitches, doc errors | 24 hours |

### Incident Response Playbooks

#### P0: Determinism Violation

**Detection:** Alert fires for determinism violation

**Response:**
```bash
# 1. IMMEDIATE: Stop executions
curl -X POST /api/admin/flags/execution_pause -d '{"value": true}'

# 2. Verify violation
pnpm run verify:drift

# 3. Check recent deployments
git log --since="24 hours ago" --oneline

# 4. Identify cause
# - Check hash algorithm changes
# - Check environment variable access
# - Check clock/time usage

# 5. If rollback needed:
git revert <commit>
git push origin main

# 6. Verify fix
pnpm run verify:drift

# 7. Resume executions
curl -X POST /api/admin/flags/execution_pause -d '{"value": false}'

# 8. Post-incident review within 24h
```

**Communication:**
- Immediate: Post to #incidents-p0
- Within 15 min: Update status page
- Within 1 hour: Customer notification if affected

#### P0: CAS Corruption

**Detection:** CAS integrity check fails

**Response:**
```bash
# 1. Stop CAS writes
kubectl scale deployment requiem --replicas=0

# 2. Assess corruption scope
requiem cas verify --all --json > corruption_report.json

# 3. Restore from backup
aws s3 sync s3://backups/requiem-cas/latest /data/cas/

# 4. Verify restoration
requiem cas verify --all

# 5. Resume service
kubectl scale deployment requiem --replicas=3

# 6. Identify root cause
# - Storage hardware issues
# - Software bugs
# - Operator error
```

#### P1: Database Connectivity Loss

**Detection:** Health check fails for database

**Response:**
```bash
# 1. Check connection pool
pnpm cli db:pool:status

# 2. Test direct connection
psql $DATABASE_URL -c "SELECT 1"

# 3. Check for connection leaks
pnpm cli db:pool:leaks

# 4. If needed, reset pool
pnpm cli db:pool:reset

# 5. If primary down, failover
# (Handled automatically by RDS/Cloud SQL)

# 6. Verify recovery
curl /api/health
```

#### P1: Circuit Breaker Cascade

**Detection:** Multiple circuit breakers open

**Response:**
```bash
# 1. Identify affected services
pnpm cli circuit-breaker:list

# 2. Check downstream health
pnpm cli health:dependencies

# 3. If downstream recovered, reset circuits
pnpm cli circuit-breaker:reset --all

# 4. If not recovered, escalate
# Contact downstream service owner

# 5. Monitor for stability
watch 'pnpm cli circuit-breaker:list'
```

#### P2: Elevated Cost Anomaly

**Detection:** Cost anomaly score >0.7

**Response:**
```bash
# 1. Identify anomalous tenant
pnpm cli cost:anomalies --window 1h

# 2. Check tenant's recent activity
pnpm cli tenant:activity --id <tenant_id> --last 1h

# 3. If malicious, suspend tenant
pnpm cli tenant:suspend --id <tenant_id> --reason "cost_anomaly"

# 4. If legitimate, increase budget
pnpm cli budget:adjust --tenant <id> --amount <new_limit>

# 5. Document finding
```

### Incident Communication Template

```
**INCIDENT: [P0/P1/P2] - [Brief Description]**

**Status:** [Investigating/Identified/Monitoring/Resolved]
**Started:** [ISO8601 timestamp]
**Impact:** [What's affected]
**Lead:** [Engineer name]

**Timeline:**
- [time] - [event]

**Next Update:** [time]
```

### Post-Incident Review

Required within 24 hours for P0, 1 week for P1:

```markdown
## Post-Incident Review: [INCIDENT-123]

### Summary
What happened in 1-2 sentences.

### Timeline
- [time] - Detection
- [time] - Response started
- [time] - Mitigation applied
- [time] - Resolution

### Impact
- Customers affected: [count]
- Data lost: [yes/no, details]
- Revenue impact: [if any]

### Root Cause
Technical explanation of why this happened.

### Contributing Factors
- Factor 1
- Factor 2

### Action Items
- [ ] Action 1 (Owner, Due Date)
- [ ] Action 2 (Owner, Due Date)

### Lessons Learned
What can we do better next time?
```

---

## Credential Rotation

### Rotation Schedule

| Credential Type | TTL | Grace Period | Notification |
|-----------------|-----|--------------|--------------|
| API Keys | 90 days | 7 days | 7, 3, 1 days before |
| Database Credentials | 30 days | 3 days | 7, 3, 1 days before |
| JWT Signing Keys | 180 days | 14 days | 30, 14, 7 days before |
| TLS Certificates | 365 days | 30 days | 60, 30, 7 days before |

### Manual Rotation Procedure

**API Keys:**
```bash
# 1. Generate new key
NEW_KEY=$(pnpm cli api-key:generate --name "rotation-$(date +%Y%m%d)")

# 2. Update services gradually
# (Use feature flags or rolling deployment)

# 3. Verify new key works
pnpm cli api-key:test --key $NEW_KEY

# 4. Revoke old key
pnpm cli api-key:revoke --id <old_key_id>

# 5. Verify no alerts
# Monitor for 24 hours
```

**Database Credentials:**
```bash
# 1. Create new user in PostgreSQL
psql $DATABASE_URL -c "CREATE USER requiem_new WITH PASSWORD '...'"

# 2. Grant permissions
psql $DATABASE_URL -c "GRANT ALL PRIVILEGES ON ALL TABLES TO requiem_new"

# 3. Update connection string in secret store
# (Doppler, Vault, etc.)

# 4. Deploy with new credentials
# Rolling restart

# 5. Drop old user
psql $DATABASE_URL -c "DROP USER requiem_old"
```

**JWT Signing Keys:**
```bash
# 1. Generate new key pair
pnpm cli jwt:key:generate --alg RS256

# 2. Add to key set (dual-sign period)
pnpm cli jwt:key:add --public-key new.pem

# 3. Update services to accept both keys
# Deploy

# 4. Switch signing to new key
pnpm cli jwt:key:promote --id <new_key_id>

# 5. After grace period, remove old key
pnpm cli jwt:key:remove --id <old_key_id>
```

### Automated Rotation

```bash
# Check rotation status
pnpm cli secrets:status

# Trigger automated rotation
pnpm cli secrets:rotate --type api_key

# Rotation workflow:
# 1. Generate new credential
# 2. Distribute to services
# 3. Verify health checks pass
# 4. Revoke old credential
# 5. Confirm no errors
```

---

## Database Migrations

### Migration Safety Procedures

**Before Production Migration:**

```bash
# 1. Verify on staging
NODE_ENV=staging pnpm cli db:migrate

# 2. Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Review migration plan
pnpm cli db:migrate --dry-run

# 4. Check migration duration estimate
pnpm cli db:migrate --estimate
```

### Running Migrations

```bash
# Run all pending migrations
pnpm cli db:migrate

# Check status
pnpm cli db:status

# View migration log
pnpm cli db:log --last 10
```

### Migration Rollback

```bash
# Rollback one migration
pnpm cli db:rollback --steps 1

# Rollback to specific version
pnpm cli db:rollback --to 002

# If rollback fails, restore from backup
pg_restore backup_file.sql
```

### Migration Troubleshooting

**Migration Stuck:**
```bash
# Check for locks
pnpm cli db:locks

# View active queries
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE state = 'active'"

# Cancel blocking query
psql $DATABASE_URL -c "SELECT pg_cancel_backend(<pid>)"

# Force unlock (emergency)
pnpm cli db:unlock --force
```

**Migration Failed:**
```bash
# Check migration log
pnpm cli db:log --last 10

# View failed migration details
pnpm cli db:status --verbose

# Manual fix (if safe)
psql $DATABASE_URL -f fix_migration.sql

# Mark as resolved
pnpm cli db:resolve --version <migration_id>
```

### Long-Running Migrations

For migrations expected to take >30 seconds:

```bash
# 1. Schedule maintenance window
# 2. Enable maintenance mode
curl -X POST /api/admin/flags/maintenance -d '{"value": true}'

# 3. Run migration with increased timeout
pnpm cli db:migrate --timeout 300

# 4. Verify success
pnpm cli db:status

# 5. Disable maintenance mode
curl -X POST /api/admin/flags/maintenance -d '{"value": false}'
```

---

## Security Incident Response

### Security Incident Classification

| Level | Description | Examples | Response |
|-------|-------------|----------|----------|
| **Critical** | Active exploitation, data breach | RCE, data exfiltration | Immediate |
| **High** | Potential breach, unauthorized access | Suspicious access patterns | 1 hour |
| **Medium** | Policy violation, misconfiguration | Unencrypted data | 24 hours |
| **Low** | Minor finding, documentation | Missing log entry | 1 week |

### Security Incident Response Playbook

#### Critical: Data Breach Suspected

**Immediate (0-15 min):**
```bash
# 1. Assemble security team
# Page: security-oncall, CTO, legal

# 2. Preserve evidence
# - Don't restart services
# - Snapshot logs
# - Capture memory dumps if needed

# 3. Isolate affected systems
# - If attacker has access, don't tip them off
# - Prepare to cut access quickly

# 4. Notify stakeholders
# - Legal (for breach notification requirements)
# - Exec team
# - Communications (if public)
```

**Containment (15-60 min):**
```bash
# 1. Identify attack vector
# - Review logs for entry point
# - Check for compromised credentials
# - Analyze malware/samples

# 2. Cut attacker access
# - Rotate suspected credentials
# - Block IP addresses
# - Disable compromised accounts

# 3. Verify containment
# - Monitor for continued activity
# - Check for backdoors
# - Verify isolation
```

**Investigation (1-24 hours):**
```bash
# 1. Scope the breach
# - What data was accessed?
# - What systems were compromised?
# - How long was the attacker present?

# 2. Preserve evidence
# - Full log export
# - Disk images
# - Network captures

# 3. Document timeline
# - First access
# - Lateral movement
# - Data exfiltration (if any)
```

**Recovery (1-7 days):**
```bash
# 1. Clean systems
# - Rebuild from known-good
# - Patch vulnerabilities
# - Harden configuration

# 2. Restore services
# - Verify no backdoors
# - Monitor closely
# - Gradual traffic increase

# 3. Verify integrity
# - CAS verification
# - Audit log integrity check
# - Determinism validation
```

**Post-Incident:**
```bash
# 1. Customer notification (if required)
# - Within 72 hours for GDPR
# - Follow legal guidance

# 2. Regulatory reporting
# - As required by jurisdiction

# 3. Security review
# - Full post-incident analysis
# - Security improvements
- Policy updates
```

#### High: Unauthorized Access Detected

**Response:**
```bash
# 1. Identify source
# - IP address
# - Account used
# - Access method

# 2. Revoke access
pnpm cli user:suspend --id <user_id>
pnpm cli token:revoke --user <user_id>

# 3. Check scope
pnpm cli audit:search --user <user_id> --since "24h ago"

# 4. Force password reset for affected account
pnpm cli user:force-password-reset --id <user_id>

# 5. Notify account owner
# - Email notification
# - Require MFA re-enrollment

# 6. Monitor for retry
# - Watch for same IP
# - Watch for same patterns
```

#### Medium: Misconfiguration Discovered

**Response:**
```bash
# 1. Assess risk
# - What data is exposed?
# - Who can access it?

# 2. Fix immediately
# - Apply correct configuration
# - Verify fix

# 3. Check for abuse
# - Review access logs
# - Check for unauthorized access

# 4. Document
# - Root cause
# - Fix applied
# - Prevention measures
```

### Evidence Preservation

```bash
# Export audit logs
pnpm cli audit:export --since "7 days ago" > evidence_audit.jsonl

# Export CAS state
requiem cas export --all > evidence_cas.json

# Capture system state
# (Use forensics tools for memory/disk)

# Hash evidence for integrity
cat evidence_* | requiem digest --stdin > evidence_hashes.txt
```

### Security Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| Security On-Call | security@readylayer.com | +1-XXX-XXX-XXXX |
| CTO | cto@readylayer.com | +1-XXX-XXX-XXXX |
| Legal | legal@readylayer.com | +1-XXX-XXX-XXXX |
| CEO | ceo@readylayer.com | +1-XXX-XXX-XXXX |

---

## References

- [OPERATIONS.md](../OPERATIONS.md) — Operational procedures
- [LAUNCH_GATE_CHECKLIST.md](../LAUNCH_GATE_CHECKLIST.md) — Pre-release verification
- [THREAT_MODEL.md](../THREAT_MODEL.md) — Security threat model
- [TROUBLESHOOTING.md](../troubleshooting.md) — Common issues
- [MIGRATION.md](../MIGRATION.md) — Database migrations
