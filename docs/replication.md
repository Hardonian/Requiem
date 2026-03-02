# Multi-Region Durability Replication

Requiem supports multi-region durability through append-only replication streams.

## Overview

The replication system provides:

- **Exportable streams**: Deterministic JSONL export of runs, decisions, and policy snapshots
- **Cursor-based pagination**: Stable cursors for incremental replication
- **Integrity verification**: Stream hashing and optional Ed25519 signatures
- **Divergence detection**: Automatic detection of fingerprint conflicts
- **Origin tagging**: All imported records tagged with source region/instance

## Configuration

Add to `~/.requiem/config.toml`:

```toml
[replication]
enabled = false          # Enable replication features
instance_id = "us-east-1" # Unique instance identifier
export_chunk_limit = 1000 # Max events per export
require_signatures = true # Require signatures on import
```

## Usage

### Export

Export events since a cursor:

```bash
# Generate a starting cursor
reach replicate cursor --from 2024-01-01
# Output: lqkc9rg0-0

# Export events
reach replicate export \
  --since lqkc9rg0-0 \
  --out replication-stream.json \
  --limit 1000 \
  --region us-east-1
```

Output format:

```json
{
  "version": "0.2.0",
  "exportedAt": "2026-03-01T20:00:00Z",
  "exportedBy": "us-east-1",
  "cursorStart": "lqkc9rg0-0",
  "cursorEnd": "lqkc9rg1-42",
  "eventCount": 42,
  "streamHash": "a1b2c3d4e5f67890",
  "events": [
    {
      "type": "RunCreated",
      "timestamp": "2026-03-01T19:30:00Z",
      "cursor": "lqkc9rg0-1",
      "region": "us-east-1",
      "instanceId": "us-east-1",
      "payload": {
        "runId": "run_abc123",
        "status": "completed",
        "policySnapshotHash": "sha256:def456"
      }
    }
  ]
}
```

### Import

Import a replication stream:

```bash
# Dry run first
reach replicate import \
  --in replication-stream.json \
  --dry-run

# Actual import
reach replicate import \
  --in replication-stream.json \
  --skip-verify
```

### Cursor Format

Cursors are stable, deterministic identifiers:

```
<timestamp-base36>-<sequence-base36>
```

Example: `lqkc9rg0-42`

- `timestamp-base36`: Milliseconds since epoch in base36
- `sequence`: Monotonic sequence number for events at same timestamp

## Durability Model

### OSS Mode

- SQLite + CAS local storage is source of truth
- Replication is pull-based via export/import
- No automatic synchronization

### Cloud Mode

- Postgres + Object storage (S3/R2) is source of truth
- Streaming replication between regions
- Same cursor format for compatibility

## Integrity Rules

1. **Unsigned manifests**: Rejected if `require_signatures = true`
2. **Fingerprint conflicts**: Marked as divergence, not overwritten
3. **Stream hash**: Must match computed hash
4. **Origin tagging**: All imports tagged with source instance/region

## Event Types

| Type | Description |
|------|-------------|
| `RunCreated` | New execution run |
| `PolicySnapshot` | Policy version snapshot |
| `ProviderDecision` | Arbitration decision |
| `ManifestSigned` | Signed execution manifest |
| `ArtifactRefs` | Artifact references |

## Divergence Handling

When fingerprint conflicts are detected:

1. Import continues for non-conflicting records
2. Conflicting records are skipped
3. Divergence events logged
4. Run marked with `divergent` badge in UI

## Security Considerations

1. **Sign streams**: Use Ed25519 signatures for tamper detection
2. **Verify on import**: Always verify signatures in production
3. **Encrypt at rest**: Stream files contain metadata (not secrets)
4. **Access control**: Limit export/import to authorized principals

## Testing

Run the round-trip test:

```bash
# Create test data
reach run system.echo "test"

# Export
reach replicate export --since lqkc9rg0-0 --out /tmp/test-stream.json

# Import to fresh instance
reach replicate import --in /tmp/test-stream.json --dry-run

# Verify
reach replicate import --in /tmp/test-stream.json
```
