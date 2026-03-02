# SSM Storage Risk Review

**Date:** 2026-03-02  
**Scope:** LocalSSMStore implementation in `packages/cli/src/lib/semantic-state-machine.ts`

---

## Executive Summary

The LocalSSMStore implementation has been hardened to infrastructure-grade quality with the following improvements:

1. ✅ **Invariant assertions** added for runtime validation
2. ✅ **Atomic write patterns** with temp file + rename
3. ✅ **Corruption handling** with backup/restore
4. ✅ **Path traversal protection** with safe path resolution
5. ✅ **Schema version enforcement** on import
6. ✅ **REQUIEM_STATE_DIR** environment variable support

---

## Risks Identified and Mitigations

### Risk 1: Non-Atomic Writes (PARTIALLY ADDRESSED)

**Before:** Direct write to states.json and transitions.json - could result in partial writes on crash.

**After:** Added atomic write pattern (write to temp file, then rename).

```typescript
private saveAtomic(data: unknown, path: string): void {
  const tempPath = `${path}.tmp`;
  writeFileSync(tempPath, JSON.stringify(data, null, 2));
  renameSync(tempPath, path); // Atomic on POSIX
}
```

**Note:** Windows does not guarantee atomic rename. For full atomicity, would need:

- Write-ahead logging
- Checksum verification
- Automatic recovery on startup

### Risk 2: Corruption Handling (ADDRESSED)

**Implementation:**

- Backup created before each write
- Automatic restore from backup on read failure
- Corruption logged but doesn't crash

### Risk 3: Path Traversal (ADDRESSED)

**Implementation:**

- Path resolved with `path.resolve()`
- Checked against basePath to prevent escape
- Relative paths rejected

### Risk 4: No File Size Limits (ACCEPTED RISK)

**Current:** No limits on states.json or transitions.json size.

**Rationale:** SSM is designed for configuration state, not high-volume data. Expected max:

- ~1000 states per project
- ~10000 transitions per project
- File size: < 10MB

**Mitigation:** Monitor size; add rotation if needed in future.

### Risk 5: Concurrent Access (ACCEPTED RISK)

**Current:** No file locking for concurrent access.

**Rationale:** CLI is primarily single-user. Concurrent access would require:

- File locking (platform-specific)
- Database backend (SQLite)

**Mitigation:** Document single-user assumption.

---

## Storage Layout

```
${REQUIEM_STATE_DIR:-.reach/state/}
├── states.json          # SemanticState[]
├── states.json.bak      # Backup (last known good)
├── transitions.json     # SemanticTransition[]
└── transitions.json.bak # Backup (last known good)
```

---

## Serialization Format

### States (JSON)

```json
[
  {
    "id": "abc123...",
    "descriptor": { ... },
    "createdAt": "2024-01-15T10:00:00Z",
    "actor": "cli",
    "integrityScore": 83,
    "labels": { "env": "prod" }
  }
]
```

### Transitions (JSON)

```json
[
  {
    "fromId": "abc123...",
    "toId": "def456...",
    "timestamp": "2024-01-15T10:00:00Z",
    "reason": "Model upgrade",
    "driftCategories": ["model_drift"],
    "changeVectors": [...],
    "integrityDelta": -5
  }
]
```

### Bundle Export

```json
{
  "version": "1.0.0",
  "exportedAt": "2024-01-15T12:00:00Z",
  "states": [...],
  "transitions": [...]
}
```

---

## Verification

Run the following to verify storage hardening:

```bash
# Run SSM tests
cd packages/cli
npx vitest run src/lib/__tests__/semantic-state-machine.test.ts

# Test with custom state dir
REQUIEM_STATE_DIR=/tmp/ssm-test reach state list

# Test import/export
reach state export --output /tmp/ledger.json
reach state import /tmp/ledger.json
```

---

## Recommendations

### Implemented

1. ✅ Invariant assertions for runtime validation
2. ✅ Schema version enforcement
3. ✅ Environment variable support
4. ✅ Atomic write pattern

### Future Enhancements (if needed)

1. SQLite backend for concurrent access
2. Compression for large datasets
3. Automatic compaction/rotation
4. Checksum verification on read

---

## Compliance

| Requirement         | Status                        |
| ------------------- | ----------------------------- |
| Atomic writes       | ⚠️ Best effort (POSIX atomic) |
| Crash recovery      | ✅ Backup/restore             |
| Path safety         | ✅ Resolved paths             |
| Schema validation   | ✅ Zod schemas                |
| Version enforcement | ✅ Bundle version check       |
| No traversal        | ✅ Path validation            |
