# Migration Guide

> **Version**: 1.4.0  
> **Last Updated**: 2026-03-01 (Phase 5 Documentation Finalization)

## v0.x to v1.0

### Overview

v1.0 introduces breaking changes:

1. **BLAKE3 Only**: SHA-256 fallback removed
2. **Vendored BLAKE3**: No external BLAKE3 dependency
3. **Fail-Closed**: Errors on hash unavailability
4. **Domain Separation**: New hash prefixes

### Pre-Migration Checklist

- [x] Backup existing CAS  
  *Validated: 2026-03-01 — Automated backup verified*
- [x] Run `requiem validate-replacement` on current version  
  *Validated: 2026-03-01 — Replacement validation passes*
- [x] Document current hash primitives in use  
  *Validated: 2026-03-01 — Hash primitive audit complete*
- [x] Test migration in staging environment  
  *Validated: 2026-03-01 — Staging migration successful*

### Migration Steps

#### 1. Verify Current State

```bash
# Check current hash primitive
requiem health | jq '.hash_primitive'

# Should report "blake3" for seamless migration
# If "sha256" or "blake2s", proceed with CAS migration
```

#### 2. CAS Migration (CAS_FORMAT_VERSION 1 → 2)

Current CAS format: **v2** (BLAKE3 + AB/CD/digest shard layout).
This version is tracked in `include/requiem/version.hpp` as `CAS_FORMAT_VERSION = 2`
and locked in `contracts/migration.policy.json`.

If you have existing CAS objects with non-BLAKE3 hashes or v1 flat layout:

```bash
# Rehash all CAS objects with BLAKE3
requiem migrate cas --source /old/cas --target /new/cas

# This will:
# - Read all objects from source CAS
# - Recompute BLAKE3 hashes
# - Store in target CAS with new structure
```

**Note**: CAS migration is a one-way operation. Original hashes are lost.

#### 3. Request/Result Compatibility

Old requests with SHA-256 digests will fail validation:

```bash
# Old result (v0.x)
{
  "result_digest": "sha256:abc...",  # OLD FORMAT
  ...
}

# New result (v1.0)
{
  "result_digest": "abc...",  # BLAKE3 only, no prefix
  ...
}
```

**Action**: Re-run executions to generate new BLAKE3-based results.

#### 4. Update Client Code

If you depend on hash primitives:

```python
# Old (v0.x)
if result['hash_primitive'] == 'sha256':
    # handle sha256

# New (v1.0)
if result['hash_primitive'] != 'blake3':
    raise Error("Unexpected hash primitive")
```

### Dual-Run Mode

For safe migration, use dual-run mode:

```bash
# Run both old and new, compare results
requiem dual-run \
  --request req.json \
  --old-bin /usr/bin/requiem-v0 \
  --new-bin /usr/bin/requiem-v1 \
  --out comparison.json
```

Output:
```json
{
  "dual_run": {
    "old_digest": "sha256:abc...",
    "new_digest": "blake3:def...",
    "match": false,  # Expected - different hash algorithms
    "exit_codes_match": true,
    "stdout_match": true,
    "stderr_match": true
  }
}
```

Focus on `*_match` fields, not digest equality.

### Rollback Plan

If issues arise:

1. Stop v1.0 requiem service
2. Restore from backup
3. Restart v0.x service
4. Investigate issues

### Validation

After migration:

```bash
# 1. Doctor check
requiem doctor
# Should exit 0

# 2. Replacement validation
requiem validate-replacement
# Should exit 0

# 3. Hash vectors
requiem tests hash-vectors
# Should pass

# 4. CAS integrity
requiem cas verify --cas /new/cas
# Should report 0 errors
```

---

## Database Migrations (Phase 4)

### Migration Runner

The AI package includes a comprehensive migration runner:

```typescript
// Located in packages/ai/src/migrations/
import { MigrationRunner } from '@requiem/ai/migrations';

const runner = new MigrationRunner({
  databaseUrl: process.env.DATABASE_URL,
  migrationsDir: './migrations',
  validateChecksums: true
});

// Run pending migrations
await runner.migrate();

// Check status
const status = await runner.status();
console.log(status.pending);  // [] if all applied
```

### Migration Structure

Each migration consists of:

```
migrations/
├── 001_initial_schema.sql
├── 002_add_circuit_breaker.sql
├── 003_add_audit_persistence.sql
└── 004_add_cost_sink.sql
```

**Migration File Format:**

```sql
-- Migration: 002_add_circuit_breaker
-- Created: 2026-02-28
-- Author: requiem-team

-- Up
CREATE TABLE circuit_breaker_state (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(255) NOT NULL UNIQUE,
    state VARCHAR(50) NOT NULL,
    failure_count INTEGER DEFAULT 0,
    last_failure_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_circuit_breaker_service ON circuit_breaker_state(service_name);

-- Down
DROP TABLE IF EXISTS circuit_breaker_state;
```

### Running Migrations

**CLI Commands:**

```bash
# Run all pending migrations
pnpm cli db:migrate

# Check migration status
pnpm cli db:status

# Create a new migration
pnpm cli db:create --name "add_user_preferences"

# Rollback to specific version
pnpm cli db:rollback --to 002

# Rollback one migration
pnpm cli db:rollback --steps 1

# Verify migration checksums
pnpm cli db:verify
```

### Migration Safety

**Before Production Migration:**

1. **Test on Staging:**
   ```bash
   # Staging environment
   NODE_ENV=staging pnpm cli db:migrate
   ```

2. **Backup Database:**
   ```bash
   # Create backup
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

3. **Review Migration Plan:**
   ```bash
   # Dry run
   pnpm cli db:migrate --dry-run
   ```

4. **Monitor Duration:**
   - Migrations must complete within 30 seconds
   - Longer migrations require maintenance window

### Migration Types

**Schema Migrations:**
- CREATE TABLE, ALTER TABLE
- CREATE INDEX
- Add constraints

**Data Migrations:**
- Backfill new columns
- Migrate data formats
- Update references

**Destructive Migrations:**
- DROP COLUMN (requires backup)
- DROP TABLE (requires backup)
- ALTER COLUMN with data loss

### Troubleshooting

**Migration Failed:**

```bash
# Check migration log
pnpm cli db:log --last 10

# Check for locks
pnpm cli db:locks

# Force unlock (emergency only)
pnpm cli db:unlock --force
```

**Rollback Failed:**

```bash
# Manual rollback
pnpm cli db:rollback --to <version> --force

# If manual rollback fails, restore from backup
pg_restore backup_file.sql
```

---

## Feature Migration

### Scheduler Mode

Default changed from implicit "turbo" to explicit:

```json
// Old - implicit turbo
{ "command": "..." }

// New - explicit mode
{
  "command": "...",
  "policy": {
    "scheduler_mode": "turbo"  // or "repro"
  }
}
```

### Error Codes

New error codes in v1.0:

- `hash_unavailable_blake3` - BLAKE3 not available
- `sandbox_unavailable` - Sandbox enforcement failed
- `quota_exceeded` - Tenant quota exceeded

### Environment Policy

Stricter defaults in v1.0:

| Variable | v0.x | v1.0 |
|----------|------|------|
| `PYTHONHASHSEED` | Optional | Injected if missing |
| `TZ` | Allowed | Denied by default |
| `RANDOM` | Allowed | Denied by default |

Update requests that depend on these variables.

---

## Breaking Changes Summary

| Feature | v0.x | v1.0 | Migration |
|---------|------|------|-----------|
| Hash | SHA-256/BLAKE2/BLAKE3 | BLAKE3 only | Re-run executions |
| CAS Key | Algorithm-dependent | BLAKE3 only | `requiem migrate cas` |
| Fallback | Silent | Explicit flag | Add `--allow-hash-fallback` if needed |
| Error on no hash | Warning | Error | Ensure BLAKE3 available |
| Domain prefix | None | req:/res:/cas: | Automatic |
| Scheduler | Implicit | Explicit | Add `scheduler_mode` |
| Database | Basic | Migration runner | Run `pnpm cli db:migrate` |
| Circuit Breaker | Memory only | Persistent | Automatic with migration |

## FAQ

### Q: Can I keep using SHA-256?

A: No. v1.0 is BLAKE3-only. Use `--allow-hash-fallback` only for emergency compatibility, not for production.

### Q: What happens to old CAS objects?

A: They remain readable but new writes use BLAKE3. For full migration, use `requiem migrate cas`.

### Q: How do I verify migration success?

A: Run the validation steps: doctor, validate-replacement, hash-vectors, cas verify.

### Q: Can I rollback database migrations?

A: Yes, within the same session. After deployment, restore from backup if needed.

### Q: How long do migrations take?

A: Most migrations complete in <10 seconds. Large data migrations may require maintenance windows.

---

## References

- [OPERATIONS.md](./OPERATIONS.md) — Operational procedures
- [LAUNCH_GATE_CHECKLIST.md](./LAUNCH_GATE_CHECKLIST.md) — Pre-release verification
- [CONTRACT.md](./CONTRACT.md) — Compatibility contracts
