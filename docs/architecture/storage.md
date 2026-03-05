# Storage Architecture

## Hash Bridge
The platform stores a dual hash mapping for every artifact:
- `artifact_hash` (BLAKE3 kernel hash)
- `runtime_hash` (SHA256 adapter/runtime hash)
- `canonical_hash` (canonical identity; currently artifact hash)

## Append-only ledgers
- Trust operations are append-only.
- Budget accounting is written into operator WAL entries.
