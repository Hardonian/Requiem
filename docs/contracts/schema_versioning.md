# Requiem Schema Versioning Policy

> **Status:** Active Policy  
> **Last Updated:** 2026-03-02  
> **Applies To:** CLI contracts, API envelopes, JSON schemas, wire formats

## Versioning Philosophy

Requiem follows [Semantic Versioning 2.0.0](https://semver.org/) (SemVer) for all contract surfaces:

- **MAJOR** (X.y.z) — Breaking changes
- **MINOR** (x.Y.z) — Backward-compatible additions
- **PATCH** (x.y.Z) — Bug fixes, no contract changes

## What Constitutes a Breaking Change

### CLI Contracts (`cli_contract.md`)

**Breaking:**

- Removing or renaming a command
- Removing or renaming a flag
- Changing exit code meanings
- Removing fields from JSON output
- Changing field types
- Making optional flags required

**Non-Breaking:**

- Adding new commands
- Adding new optional flags
- Adding new fields to JSON output
- Adding new error codes

### API Envelopes (`api_envelope_contract.md`)

**Breaking:**

- Changing envelope structure
- Removing required fields
- Changing field types
- Removing error codes

**Non-Breaking:**

- Adding new optional fields
- Adding new error codes
- Extending enum values (with fallback handling)

### JSON Schemas

**Breaking:**

- Removing properties
- Changing property types
- Adding properties to `required` array
- Tightening validation (e.g., reducing maxLength)

**Non-Breaking:**

- Adding optional properties
- Adding to `enum` with default handling
- Loosening validation

## Deprecation Process

### Step 1: Mark Deprecated (Minor Release)

```typescript
// Add @deprecated JSDoc
function oldCommand() { ... }

// Output deprecation warning
console.warn("[DEPRECATED] Command 'old-cmd' will be removed in v2.0.0. Use 'new-cmd' instead.");
```

Document in:

- Code comments
- CLI help text
- CHANGELOG.md
- Contract docs (with deprecation version)

### Step 2: Compatibility Shim (Same Minor)

```typescript
// Provide alias that maps to new implementation
if (cmd === 'old-cmd') {
  console.warn("[DEPRECATED] 'old-cmd' is deprecated, using 'new-cmd'");
  cmd = 'new-cmd';
}
```

### Step 3: Sunset Period (Full Major Cycle)

Deprecated features remain functional through the entire major version:

- v1.5.0: Feature deprecated
- v1.6.0: Still works with warning
- v1.99.0: Still works with warning
- v2.0.0: **Removed** (breaking change)

### Step 4: Removal (Next Major)

Remove in first minor of new major:

- v2.0.0: Deprecated features removed

## Version Bump Rules

| Change Type | Version Bump | Example |
| :--- | :--- | :--- |
| Bug fix, no contract change | PATCH | 1.2.3 → 1.2.4 |
| New optional feature | MINOR | 1.2.3 → 1.3.0 |
| Deprecation notice only | MINOR | 1.2.3 → 1.3.0 |
| Breaking change | MAJOR | 1.2.3 → 2.0.0 |

## Backward Compatibility Guarantees

### Forward Compatibility (Old Client → New Server)

A client built against v1.2.0 should work with a v1.5.0 server:

- Server adds new fields → Client ignores unknown fields
- Server adds new commands → Client unaffected
- Server adds new error codes → Client falls back to generic handling

### Backward Compatibility (New Client → Old Server)

Not guaranteed by default validation. New clients may depend on new features.

## Compatibility Matrix

| Client \ Server | v1.2.x | v1.3.x | v2.0.x |
| :--- | :--- | :--- | :--- |
| v1.2.x | ✅ Full | ✅ Forward | ❌ Breaking |
| v1.3.x | ⚠️ Partial | ✅ Full | ❌ Breaking |
| v2.0.x | ❌ Breaking | ❌ Breaking | ✅ Full |

## Testing Compatibility

### Contract Snapshots

Committed snapshots at `tests/contracts/`:

- `cli-help.snapshot.txt` — CLI help output
- `api-envelope.snapshot.json` — API response shapes

### CI Enforcement

```bash
# Run on PR
make verify:contracts
```

Fails if:

- Breaking changes detected
- Snapshots don't match
- New fields not following naming conventions

### Compatibility Checklist

Before releasing:

- [ ] No breaking changes in PATCH release
- [ ] Deprecation warnings for sunset features
- [ ] Contract snapshots updated
- [ ] CHANGELOG.md documents changes
- [ ] Migration guide for MAJOR changes

## Emergency Breaking Changes

In exceptional circumstances (security, data loss), breaking changes may be introduced in MINOR with:

1. Security advisory documenting the issue
2. Clear migration path
3. Extended support window for previous minor
4. Community announcement 30 days in advance

## Current Contract Versions

| Contract | Current Version | Frozen Until |
| :--- | :--- | :--- |
| CLI Commands | v1.x | v2.0.0 |
| API Envelope | v1.x | v2.0.0 |
| CAS Format | v2 | v3.0.0 |
| Policy Schema | v1 | v2.0.0 |
| Capability Token | v1 | v2.0.0 |

## Migration Guides

### v1.x to v2.0 (Future)

*This section will be populated when v2.0 planning begins.*

Key considerations for v2.0:

- CLI command reorganization (flatter structure)
- Policy schema simplification
- CAS compression default change

## References

- [Semantic Versioning 2.0.0](https://semver.org/)
- `docs/contracts/cli_contract.md`
- `docs/contracts/api_envelope_contract.md`
- `CHANGELOG.md`
