# Content-Addressable Storage (CAS)

## Version

CAS format: **v2**

## Storage Layout

```
.cas/v2/objects/
  AB/
    CD/
      ABCDEF0123456789...   # stored blob (identity or zstd-compressed)
      ABCDEF0123456789...meta  # metadata JSON
```

Sharding: 2-level directory structure using first 2 and next 2 hex characters of the digest.

## Metadata Format

```json
{
  "digest": "<64-char hex BLAKE3 digest of original content>",
  "encoding": "identity" | "zstd",
  "original_size": <integer>,
  "stored_size": <integer>,
  "stored_blob_hash": "<64-char hex BLAKE3 digest of stored blob>"
}
```

## Integrity Model

### Write Path
1. Compute `digest = BLAKE3(content)`.
2. If object already exists (both blob and meta present), return `digest` (dedup).
3. Optionally compress with zstd → `stored`.
4. Compute `stored_blob_hash = BLAKE3(stored)`.
5. Write blob to temp file, then `rename()` into place (atomic).
6. Write meta to temp file, then `rename()` into place (atomic).
7. On meta write failure, remove the blob (rollback).

### Read Path
1. Validate digest format (64 lowercase hex chars).
2. Read stored blob bytes.
3. Read metadata.
4. Verify `BLAKE3(stored_blob) == stored_blob_hash`. If not → `nullopt`.
5. Decompress if `encoding == "zstd"`.
6. Verify `BLAKE3(decompressed) == digest`. If not → `nullopt`.

This dual verification detects both storage corruption and compression/decompression errors.

## Digest Validation

All digest strings are validated before use:
- Must be exactly 64 characters
- Must be lowercase hex (`[0-9a-f]`)
- Invalid digests are rejected immediately (no filesystem access)

## Operations

| Operation | Description |
|-----------|-------------|
| `put(data, compression)` | Store content, return digest |
| `get(digest)` | Retrieve and verify content |
| `contains(digest)` | Check existence (no verification) |
| `info(digest)` | Read metadata |
| `scan_objects()` | List all objects with metadata |
| `size()` | Count objects |
