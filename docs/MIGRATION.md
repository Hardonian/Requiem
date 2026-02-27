# Migration Guide

## v0.x to v1.0

### Overview

v1.0 introduces breaking changes:

1. **BLAKE3 Only**: SHA-256 fallback removed
2. **Vendored BLAKE3**: No external BLAKE3 dependency
3. **Fail-Closed**: Errors on hash unavailability
4. **Domain Separation**: New hash prefixes

### Pre-Migration Checklist

- [ ] Backup existing CAS
- [ ] Run `requiem validate-replacement` on current version
- [ ] Document current hash primitives in use
- [ ] Test migration in staging environment

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

## Breaking Changes Summary

| Feature | v0.x | v1.0 | Migration |
|---------|------|------|-----------|
| Hash | SHA-256/BLAKE2/BLAKE3 | BLAKE3 only | Re-run executions |
| CAS Key | Algorithm-dependent | BLAKE3 only | `requiem migrate cas` |
| Fallback | Silent | Explicit flag | Add `--allow-hash-fallback` if needed |
| Error on no hash | Warning | Error | Ensure BLAKE3 available |
| Domain prefix | None | req:/res:/cas: | Automatic |
| Scheduler | Implicit | Explicit | Add `scheduler_mode` |

## FAQ

### Q: Can I keep using SHA-256?

No. v1.0 is BLAKE3-only for determinism and security.

### Q: Will old CAS objects work?

No. CAS keys are BLAKE3-only. You must migrate.

### Q: Is there a migration tool?

Yes: `requiem migrate cas`

### Q: Can I run v0.x and v1.0 side by side?

Yes, use `requiem dual-run` to compare.

### Q: What if validate-replacement fails?

Check blockers with `requiem doctor` and fix each one.

Common blockers:
- `hash_primitive_not_blake3` - Using old binary
- `hash_vectors_failed` - Corrupted build

## Support

For migration assistance:

1. Run `requiem doctor --verbose`
2. Capture output
3. Open issue with details
