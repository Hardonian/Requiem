# Requiem Durability Model

This model defines the real persistence contract for durability-sensitive write paths and startup recovery.

## Global Rules

- Writes use **temp file -> fsync(file) -> rename -> fsync(parent dir)** where file replacement semantics are required.
- WAL-style append logs use **append -> fsync(log file)** before acknowledging durability.
- Recovery is classification-first: startup emits `committed | rolled_back | repaired | quarantined | unrecoverable`.

## CAS object writes

- **Write order:** create temp blob, write bytes, fsync temp blob, rename to content-addressed path, fsync CAS directory.
- **Durability boundary:** after parent directory fsync.
- **fsync/commit:** required on file and directory.
- **Atomicity assumptions:** same-filesystem rename atomicity.
- **Recovery after interruption:**
  - before rename: no durable object visible;
  - after rename before dir fsync: object may exist but crash classification treats this as potentially repaired state until validated.

## WAL / execution log

- **Write order:** append entry, fsync log file.
- **Durability boundary:** fsync returns successfully.
- **fsync/commit:** required per durability-sensitive transition.
- **Atomicity assumptions:** append semantics at file level; partial tail line can occur.
- **Recovery after interruption:** parser validates line-by-line JSON; truncated/invalid tail is detected and classified for repair/rollback.

## Proofpack generation

- **Write order:** write blob atomically, then write manifest atomically referencing blob.
- **Durability boundary:** manifest rename + manifest parent directory fsync.
- **fsync/commit:** blob fsync + manifest fsync + directory fsync.
- **Atomicity assumptions:** manifest is source of truth; blob without manifest is non-committed.
- **Recovery after interruption:**
  - blob without manifest => rolled_back/repaired;
  - manifest without blob => quarantined/unrecoverable until repaired.

## Execution state checkpoints

- **Write order:** checkpoint temp write, fsync, rename, directory fsync.
- **Durability boundary:** checkpoint directory fsync.
- **fsync/commit:** required.
- **Atomicity assumptions:** atomic rename.
- **Recovery after interruption:** previous checkpoint remains valid or new checkpoint fully visible.

## Adapter receipts

- **Write order:** append receipt log entry, fsync.
- **Durability boundary:** fsync returns.
- **fsync/commit:** required for durable receipt semantics.
- **Atomicity assumptions:** append may leave tail corruption on abrupt crash.
- **Recovery after interruption:** invalid tail receipt is excluded and run classified repaired/rolled_back.

## Queue/task state

- **Write order:** claim persisted, then ack persisted.
- **Durability boundary:** per-entry fsync.
- **fsync/commit:** required between claim and ack.
- **Atomicity assumptions:** claim and ack are independent durable events.
- **Recovery after interruption:** claimed-unacked tasks are resumed or rolled back; duplicates are prevented or explicitly classified.
