# Runbook: Protocol / CAS Version Bump Procedure

**Severity:** P3 (planned operation)
**Requires:** `admin` RBAC role, PR review, full CI green

## When to Bump

| Constant | Bump When |
|----------|-----------|
| `HASH_ALGORITHM_VERSION` | Hash primitive changes (e.g., BLAKE3 → SHA3) |
| `CAS_FORMAT_VERSION` | CAS shard layout, meta format, or prefix changes |
| `PROTOCOL_FRAMING_VERSION` | Required frame fields added/removed |
| `REPLAY_LOG_VERSION` | Replay log JSON schema changes |
| `ENGINE_ABI_VERSION` | C API struct layout changes |
| `AUDIT_LOG_VERSION` | Audit log NDJSON schema changes |

## Pre-Bump Checklist

- [ ] Root cause for the bump is documented (not just "felt like it")
- [ ] Migration path is defined (old → new; never silent rejection)
- [ ] Rollback path is documented (what happens if we need to revert)
- [ ] All cluster nodes can be updated simultaneously (or drained first)

## Bump Procedure

1. **Update `include/requiem/version.hpp`:**
   ```cpp
   constexpr uint32_t CAS_FORMAT_VERSION = 3;  // was 2
   ```

2. **Update `contracts/compat.matrix.json`:**
   - Add new entry to `version_history[]` with `status: "current"`
   - Mark old entry as `status: "deprecated"`
   - Update `current_versions{}` map
   - Add to `incompatible_combinations[]` if cross-version is invalid

3. **Update `contracts/migration.policy.json`:**
   - Update `locked_versions` map
   - Add migration entry in `cas_migrations[]` or `protocol_migrations[]`

4. **Update `contracts/determinism.contract.json`:**
   - Update the relevant `change_gate` field
   - Update `cas.format_version` or `protocol_framing.version`

5. **Update `policy/default.policy.json`:**
   - Update `cas.allowed_format_versions` or equivalent

6. **Regenerate golden corpus:**
   ```bash
   ./scripts/generate_golden_corpus.sh
   ```

7. **Run full verification:**
   ```bash
   ./scripts/verify.sh
   ./scripts/verify_compat_matrix.sh
   ./scripts/verify_migrations.sh
   ./scripts/verify_determinism.sh
   ./scripts/verify_formal.sh
   ```

8. **PR footer must include:**
   ```
   Migration: bumped CAS_FORMAT_VERSION 2 -> 3
   Compat-Matrix: updated contracts/compat.matrix.json
   Determinism-Contract: bumped cas.format_version 2 -> 3
   ```

## Post-Bump

- Monitor cluster drift for 24 hours after deploy.
- Run `./scripts/verify_cluster.sh` on all nodes.
- Confirm `verify:compat_matrix` passes on deployed cluster.
