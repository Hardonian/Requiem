# Runbook: CAS Corruption Incident

**Severity:** P1
**Trigger:** CAS integrity check returns `cas_integrity_failed` for any stored object
**Auto-capture:** Yes (policy `auto_capture_on_cas_corruption`)

## What This Means

A CAS object's content does not match its stored digest. This is a critical data
integrity violation — content-addressed storage guarantees that content never changes
for a given hash. Any corruption must be treated as data loss.

**Possible causes:**
1. Filesystem corruption (disk error, storage bug)
2. Partial write accepted (chaos scenario `cas_partial_write`)
3. Binary overwrite bug in CAS writer (violates INV-2)
4. Hash algorithm change without migration
5. Storage backend failure (S3 silent corruption, etc.)

## Immediate Actions (< 5 minutes)

1. **Capture bundle:**
   ```bash
   reach bugreport --bundle --incident <ticket_id>
   ```

2. **Activate CAS write kill switch** (prevent additional corruption):
   ```bash
   # Edit policy/default.policy.json: "kill_switch_cas_writer": true
   # Restart all engine nodes.
   # Reads remain functional.
   ```

3. **Identify affected objects:**
   ```bash
   # Run CAS integrity scan
   curl -H "Authorization: Bearer $TOKEN" /api/cas/integrity
   ```

4. **Quarantine corrupted objects:**
   ```bash
   # Move corrupted objects to .quarantine
   find $CAS_ROOT -name "*.meta" | while read meta; do
     digest=$(basename $(dirname $meta))$(basename $meta .meta)
     # verify each object
   done
   ```

## Investigation

1. **Verify CAS gate:**
   ```bash
   ./scripts/verify_cas.sh
   ```

2. **Check storage backend:**
   - Review disk error logs (`dmesg`, storage controller logs)
   - Run filesystem check: `fsck` or equivalent

3. **Check for write path bug:**
   ```bash
   # Was a new CAS format version deployed?
   ./scripts/verify_version_contracts.sh
   # Was there a recent code change to src/cas.cpp?
   git log --oneline -10 -- src/cas.cpp
   ```

4. **Replay from upstream:**
   - If the execution inputs are available, re-execute to regenerate the CAS object.

## Recovery

1. **If disk corruption:** Replace disk. Restore from backup or re-execute.
2. **If write bug:** Revert code. Re-execute affected workloads. Add test.
3. **If hash change:** Run migration script. See `docs/MIGRATION.md`.
4. **If no recovery possible:** Document objects as permanently lost.

## Post-Incident

1. Add chaos test case for the corruption vector.
2. Enhance CAS write integrity check if bypass was possible.
3. Review `scripts/verify_cas.sh` for the detection gap.
4. Consider enabling Merkle audit chain (`enable_merkle_audit_chain` flag).

## Invariant Reminders

- **CAS-INV-1**: Never overwrite an existing object with different content.
- **CAS-INV-2**: Every written object must be immediately verifiable.
- **NoPartialWrite**: Partial writes must be rejected, not silently accepted.
