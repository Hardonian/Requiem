# KERNEL_SPEC.md — Requiem Kernel Architecture Specification

> Version: 1.0.0  
> Status: LOCKED  
> Author: Opus 4.6 (Antigravity)  
> Date: 2026-03-02

---

## 0. Scope & Boundary

The **kernel** is the minimal, deterministic, replay-provable core of Requiem. Everything in the kernel MUST be:

1. **Deterministic** — same inputs → same outputs, byte-for-byte.
2. **Auditable** — every mutation is recorded with prev-hash chaining.
3. **Capability-gated** — no ambient authority; privileged actions require tokens.
4. **Cost-bounded** — every operation is metered with hard denial on budget exceeded.

The kernel explicitly EXCLUDES:

- UI rendering
- Web framework routing
- AI model inference (model runners are external processes invoked by plan steps)
- Network transport (the kernel operates on local state; replication is an extension)

```text
┌─────────────────────────────────────────────────────────┐
│                     CLI / API Surface                     │
│  (typed envelope in, typed envelope out)                 │
├─────────────────────────────────────────────────────────┤
│                        KERNEL                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Boundary │ │ EventLog │ │   CAS    │ │   Caps   │   │
│  │ (encode) │ │ (append) │ │ (store)  │ │ (authz)  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ PolicyVM │ │  Meter   │ │  Plan    │ │ Receipt  │   │
│  │  (eval)  │ │ (budget) │ │  (DAG)   │ │ (proof)  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
├─────────────────────────────────────────────────────────┤
│                   Extension / View Layer                  │
│  (ReadyLayer UI, TS CLI, AI packages, replication)       │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Canonical Encoding

### 1.1 Format

All kernel data structures are encoded as **canonical JSON** using the existing `jsonlite` library. Canonical JSON is defined as:

- Keys sorted lexicographically (guaranteed by invariant `std::map` iteration ordering)
- No whitespace between tokens
- Strings escaped per RFC 8259
- Integers as decimal (`uint64_t`) — never floating-point
- Booleans as `true`/`false`
- No `null` — absent fields are omitted
- No duplicate keys (enforced by `jsonlite::validate_strict()`)

### 1.2 Why Not CBOR

The existing codebase uses canonical JSON throughout (canonicalize_request, canonicalize_result, audit log, CAS index). Switching to CBOR would:

- Break all existing stored digests
- Require dual-format support during migration
- Add a dependency for no measurable benefit at current scale

**Decision**: Canonical JSON (existing) is the encoding format. If binary encoding is needed later, add it as `encoding_version=2` alongside JSON.

### 1.3 Encoding Version

```cpp
CANONICAL_ENCODING_VERSION = 1
```

All encoded payloads carry this version implicitly through the `HASH_ALGORITHM_VERSION` and `ENGINE_ABI_VERSION` constants in `version.hpp`.

---

## 2. Hash Algorithm & Domain Separation

### 2.1 Algorithm

- **Primitive**: BLAKE3-256
- **Implementation**: Vendored C library (`third_party/blake3/`)
- **Output**: 32 bytes raw, 64 hex chars in text form
- **Version**: `HASH_ALGORITHM_VERSION = 1`
- **No fallback**: BLAKE3 is the only accepted primitive. `set_hash_fallback_allowed(false)` is permanent.

### 2.2 Domain Separation Tags

Domain separation prevents cross-context hash collisions. Each domain tag is prepended to the hasher input as a raw prefix:

| Tag       | Function                 | Used For                                           |
| --------- | ------------------------ | -------------------------------------------------- |
| `"req:"`  | `canonical_json_hash()`  | Request canonicalization digest                    |
| `"res:"`  | `result_json_hash()`     | Result canonicalization digest                     |
| `"cas:"`  | `cas_content_hash()`     | CAS object content digest                          |
| `"evt:"`  | `event_hash()`           | Event log entry digest (NEW)                       |
| `"cap:"`  | `capability_hash()`      | Capability token fingerprint (NEW)                 |
| `"pol:"`  | `policy_hash()`          | Policy evaluation proof digest (NEW)               |
| `"rcpt:"` | `receipt_hash()`         | Receipt digest (NEW)                               |
| `"plan:"` | `plan_hash()`            | Plan graph step digest (NEW)                       |
| (none)    | `blake3_hex()`           | Raw hashing (non-domain data)                      |
| (none)    | `deterministic_digest()` | Generic deterministic hash (stdout, stderr, trace) |

### 2.3 Hash Formula

```text
H(domain, payload) = BLAKE3( domain_tag_bytes || payload_bytes )
```

Where `||` is byte concatenation. The domain tag is NOT length-prefixed — tags have distinct, non-overlapping prefixes by construction (the colon suffix ensures no tag is a prefix of another).

### 2.4 HashEnvelope

Every digest stored or transmitted includes metadata for algorithm versioning:

```cpp
struct HashEnvelope {
    uint32_t hash_version{1};          // Bump when algorithm changes
    char     algorithm[16]{"blake3"};  // Null-terminated name
    char     engine_version[32]{};     // BLAKE3 library version string
    uint8_t  payload_hash[32]{};       // Raw 32-byte BLAKE3 output
};
```

**Compatibility rule**: A verifier MUST check `hash_version` before comparing digests. Mismatched versions → hard fail with `ErrorCode::hash_version_mismatch`.

---

## 3. Versioned Schema Envelope

### 3.1 Envelope Structure

Every CLI response and API response is wrapped in a typed envelope:

```json
{
  "v": 1,
  "kind": "exec.result",
  "data": { ... },
  "error": null
}
```

| Field   | Type                    | Description                                           |
| ------- | ----------------------- | ----------------------------------------------------- |
| `v`     | `uint32`                | Envelope schema version (currently 1)                 |
| `kind`  | `string`                | Dot-separated type identifier                         |
| `data`  | `object \| null`        | Success payload                                       |
| `error` | `ErrorEnvelope \| null` | Error payload (mutually exclusive with data on error) |

### 3.2 Typed Error Envelope

```json
{
  "v": 1,
  "kind": "error",
  "data": null,
  "error": {
    "code": "cas_integrity_failed",
    "message": "Object hash mismatch for digest abc123...",
    "details": {},
    "retryable": false
  }
}
```

| Field       | Type     | Description                                                   |
| ----------- | -------- | ------------------------------------------------------------- |
| `code`      | `string` | Machine-readable error code from `ErrorCode` enum             |
| `message`   | `string` | Human-readable description                                    |
| `details`   | `object` | Additional structured context (e.g., expected vs actual hash) |
| `retryable` | `bool`   | Whether the caller should retry                               |

### 3.3 Kind Registry

| Kind                 | Description                     |
| -------------------- | ------------------------------- |
| `exec.result`        | Execution result                |
| `exec.stream.start`  | NDJSON stream start frame       |
| `exec.stream.event`  | NDJSON stream trace event       |
| `exec.stream.end`    | NDJSON stream end frame         |
| `cas.put.result`     | CAS put result                  |
| `cas.info.result`    | CAS object info                 |
| `caps.mint.result`   | Capability token minted         |
| `caps.verify.result` | Capability verification outcome |
| `policy.eval.result` | Policy evaluation result        |
| `plan.run.result`    | Plan execution result           |
| `plan.run.receipt`   | Signed receipt for plan run     |
| `log.verify.result`  | Event log verification result   |
| `doctor.result`      | Doctor check results            |
| `error`              | Error envelope                  |

### 3.4 Compatibility Rules

1. Fields may be ADDED to `data` in any version — readers MUST ignore unknown fields.
2. Fields MUST NOT be removed or renamed without bumping `v`.
3. A `v=2` endpoint MUST still accept `v=1` requests and return `v=1` responses if the request specifies `v=1`.

---

## 4. EventLog

### 4.1 EventRecord Layout

The EventLog is the immutable, append-only audit trail. Each entry is a JSON line (NDJSON):

```json
{
  "seq": 1,
  "prev": "0000000000000000000000000000000000000000000000000000000000000000",
  "ts_logical": 1,
  "event_type": "exec.complete",
  "actor": "cap:fingerprint_hex",
  "data_hash": "abc123...",
  "execution_id": "req_digest_hex",
  "tenant_id": "tenant-alpha",
  "request_digest": "...",
  "result_digest": "...",
  "engine_semver": "1.3.0",
  "engine_abi_version": 2,
  "hash_algorithm_version": 1,
  "cas_format_version": 2,
  "replay_verified": true,
  "ok": true,
  "error_code": "",
  "duration_ns": 5000000,
  "worker_id": "w-abc",
  "node_id": "n-xyz"
}
```

### 4.2 Prev-Hash Chain

Each record's `prev` field contains:

```text
prev = H("evt:", canonical_json(previous_record))
```

The genesis record uses `prev = "0" * 64` (64 zero hex chars).

**Verification**: Walk the chain from genesis. For each record N:

1. Compute `expected_prev = H("evt:", canonical_json(record[N-1]))`
2. Assert `record[N].prev == expected_prev`
3. If mismatch → chain is tampered, verification fails

### 4.3 Logical Time

The `ts_logical` field is a monotonically increasing uint64, incremented by 1 per event. It MUST NOT use wall-clock time in the kernel. Wall-clock `timestamp_unix_ms` is captured for human readability but is NOT part of the chain hash computation.

### 4.4 Event Types

| Event Type           | When                                       |
| -------------------- | ------------------------------------------ |
| `exec.complete`      | After every execution (success or failure) |
| `cap.mint`           | Capability token minted                    |
| `cap.revoke`         | Capability token revoked                   |
| `policy.add`         | Policy rule added                          |
| `policy.eval`        | Policy evaluation completed                |
| `plan.run.start`     | Plan execution started                     |
| `plan.run.complete`  | Plan execution finished                    |
| `plan.step.complete` | Individual plan step finished              |
| `meter.budget.set`   | Budget allocated for tenant                |
| `meter.deny`         | Budget exceeded, operation denied          |

---

## 5. Content-Addressable Storage (CAS)

### 5.1 ObjectRef Format

```text
ObjectRef = H("cas:", raw_bytes)
```

Result: 64-char lowercase hex string. Used as the unique identifier for any stored object.

### 5.2 Operations

#### `put(data, compression?) → ObjectRef`

1. Compute `digest = H("cas:", data)`
2. If object exists at `objects/AB/CD/<digest>` → return `digest` (dedup)
3. Write to temp file, then atomic rename into `objects/AB/CD/<digest>`
4. Append entry to `index.ndjson` with metadata
5. Return `digest`

#### `get(ObjectRef) → data | error`

1. Validate digest format (64 hex chars)
2. Read from `objects/AB/CD/<digest>`
3. If compressed, decompress
4. Verify: `H("cas:", decompressed_data) == digest`
5. If mismatch → return error (tamper detected)
6. Return `decompressed_data`

#### `has(ObjectRef) → bool`

Check existence at `objects/AB/CD/<digest>` without reading content.

#### `verify(ObjectRef) → VerifyResult`

Full integrity check: read + decompress + re-hash + compare.

```json
{
  "digest": "...",
  "ok": true,
  "stored_size": 1024,
  "original_size": 2048,
  "encoding": "zstd",
  "hash_match": true
}
```

### 5.3 Tamper Detection

On every `get()`, the CAS re-computes `H("cas:", data)` and compares with the requested digest. Mismatch → `ErrorCode::cas_integrity_failed`, object quarantined, event logged.

### 5.4 Storage Layout

```text
.requiem/cas/v2/
├── objects/
│   └── AB/
│       └── CD/
│           └── <64-char-digest>       # raw or compressed content
│           └── <64-char-digest>.meta  # JSON metadata sidecar
├── index.ndjson                       # append-only object index
```

---

## 6. Capabilities

### 6.1 Token Structure

A capability token grants specific permissions. Tokens are ed25519-signed JSON structures:

```json
{
  "cap_version": 1,
  "fingerprint": "H('cap:', canonical_json(payload))",
  "issuer_fingerprint": "...",
  "subject": "tenant-alpha",
  "permissions": ["exec.run", "cas.put", "plan.run"],
  "not_before": 0,
  "not_after": 0,
  "nonce": 123456,
  "signature": "ed25519_hex_signature"
}
```

| Field                | Type       | Description                                                           |
| -------------------- | ---------- | --------------------------------------------------------------------- |
| `cap_version`        | `uint32`   | Token format version (1)                                              |
| `fingerprint`        | `string`   | `H("cap:", canonical_json(payload_without_signature))`                |
| `issuer_fingerprint` | `string`   | Fingerprint of the issuing capability (root = self)                   |
| `subject`            | `string`   | Tenant or entity this token applies to                                |
| `permissions`        | `string[]` | Granted actions                                                       |
| `not_before`         | `uint64`   | Logical time (0 = immediate)                                          |
| `not_after`          | `uint64`   | Logical time (0 = no expiry)                                          |
| `nonce`              | `uint64`   | Anti-replay nonce                                                     |
| `signature`          | `string`   | ed25519 signature over the canonical JSON (excluding signature field) |

### 6.2 Operations

#### `mint(permissions, subject, signing_key) → CapabilityToken`

1. Construct payload (all fields except `signature` and `fingerprint`)
2. Compute `fingerprint = H("cap:", canonical_json(payload))`
3. Sign `canonical_json(payload_with_fingerprint)` with ed25519
4. Store fingerprint in event log (`cap.mint` event)
5. Return complete token

#### `verify(token, action) → bool`

1. Check `cap_version == 1`
2. Verify ed25519 signature against issuer's public key
3. Check `action` is in `permissions`
4. Check logical time bounds (`not_before <= current_logical_time <= not_after`, or `not_after == 0`)
5. Check fingerprint is not in revocation set
6. Return true/false

#### `revoke(fingerprint, signing_key)`

1. Add fingerprint to revocation set
2. Log `cap.revoke` event in event log
3. Revocation is permanent and anchored in the chain

### 6.3 Security Properties

- **No ambient authority**: Every privileged CLI command requires a valid capability token
- **Store fingerprints, never secrets**: Only the fingerprint (hash) goes into the event log, never the private key or full token
- **Revocation anchored in log**: Revocation events are part of the prev-hash chain — cannot be silently undone

---

## 7. Policy VM

### 7.1 Deterministic Eval Interface

The Policy VM evaluates rules against a context and produces a deterministic decision:

```text
eval(policy_rules, context) → PolicyDecision
```

Where:

- `policy_rules`: JSON array of rules (stored in CAS)
- `context`: JSON object with execution request data
- `PolicyDecision`: deterministic result including proof hash

### 7.2 Rule Schema

```json
{
  "rule_id": "R001",
  "condition": {
    "field": "request.tenant_id",
    "op": "eq",
    "value": "tenant-alpha"
  },
  "effect": "allow",
  "priority": 100
}
```

Supported operators: `eq`, `neq`, `in`, `not_in`, `exists`, `gt`, `lt`, `gte`, `lte`, `matches` (regex).

### 7.3 Evaluation Order

1. Rules sorted by `priority` descending (highest first)
2. First matching rule's `effect` determines the decision
3. If no rule matches → default deny
4. Result includes which rule matched and why

### 7.4 Decision Schema

```json
{
  "decision": "allow",
  "matched_rule_id": "R001",
  "context_hash": "H('pol:', canonical_json(context))",
  "rules_hash": "H('pol:', canonical_json(rules))",
  "proof_hash": "H('pol:', canonical_json(decision_record))",
  "evaluated_at_logical_time": 42
}
```

### 7.5 Proof Hash Formula

```text
proof_hash = H("pol:", canonical_json({
    "context_hash": H("pol:", canonical_json(context)),
    "rules_hash": H("pol:", canonical_json(rules)),
    "decision": "allow",
    "matched_rule_id": "R001"
}))
```

The proof hash is stored in CAS. Replay produces the same proof hash given the same context + rules.

---

## 8. Metering

### 8.1 Units

| Unit          | Represents               |
| ------------- | ------------------------ |
| `exec`        | One execution invocation |
| `cas_put`     | One CAS write operation  |
| `cas_get`     | One CAS read operation   |
| `policy_eval` | One policy evaluation    |
| `plan_step`   | One plan step execution  |

### 8.2 Budget Model

Each tenant has a budget:

```json
{
  "tenant_id": "tenant-alpha",
  "budgets": {
    "exec": { "limit": 1000, "used": 42, "remaining": 958 },
    "cas_put": { "limit": 5000, "used": 100, "remaining": 4900 }
  },
  "budget_hash": "H('meter:', canonical_json(budgets))"
}
```

### 8.3 Denial Semantics

When `remaining == 0` for a required unit:

1. Operation is NOT performed
2. Return `ErrorCode::quota_exceeded` in typed error envelope
3. Log `meter.deny` event in event log
4. Emit denial receipt (see §9)
5. Exit code: 2

**Hard denial**: The kernel MUST NOT perform partial work when budget is exceeded. Check budget BEFORE executing.

### 8.4 Receipt Schema

Every metered operation produces a receipt:

```json
{
  "receipt_version": 1,
  "operation": "exec",
  "tenant_id": "tenant-alpha",
  "request_digest": "...",
  "units_charged": 1,
  "budget_before": 958,
  "budget_after": 957,
  "denied": false,
  "receipt_hash": "H('rcpt:', canonical_json(this_without_receipt_hash))",
  "event_log_seq": 42
}
```

---

## 9. Snapshots

### 9.1 Checkpointed State

A snapshot captures the complete kernel state at a logical time:

```json
{
  "snapshot_version": 1,
  "logical_time": 100,
  "event_log_head": "digest_of_last_event",
  "cas_root_hash": "H('cas:', sorted_concat(all_object_digests))",
  "active_caps": ["fingerprint1", "fingerprint2"],
  "revoked_caps": ["fingerprint3"],
  "budgets": { "tenant-alpha": { ... } },
  "policies": { "policy_set_hash": "..." },
  "snapshot_hash": "H('snap:', canonical_json(this_without_snapshot_hash))"
}
```

### 9.2 Restore Rules

1. Load snapshot from CAS
2. Verify `snapshot_hash`
3. Set `logical_time` to snapshot value
4. Load event log from snapshot's `event_log_head` forward
5. Replay all events after snapshot to rebuild in-memory state

### 9.3 Replay Alignment

After restore + replay, the state MUST produce identical `event_log_head` and `cas_root_hash` as computed from scratch. If not → restore failed, error reported.

---

## 10. Plan Graph

### 10.1 Graph Schema

A plan is a directed acyclic graph (DAG) of steps:

```json
{
  "plan_id": "plan-001",
  "plan_version": 1,
  "steps": [
    {
      "step_id": "step-1",
      "kind": "exec",
      "depends_on": [],
      "config": {
        "command": "/bin/sh",
        "argv": ["-c", "echo hello"],
        "workspace_root": ".",
        "timeout_ms": 5000
      }
    },
    {
      "step_id": "step-2",
      "kind": "exec",
      "depends_on": ["step-1"],
      "config": {
        "command": "/bin/sh",
        "argv": ["-c", "echo world"],
        "workspace_root": "."
      }
    }
  ],
  "plan_hash": "H('plan:', canonical_json(steps))"
}
```

### 10.2 Step Kinds

| Kind          | Description                                   |
| ------------- | --------------------------------------------- |
| `exec`        | Execute a command (uses existing `execute()`) |
| `cas_put`     | Store data in CAS                             |
| `policy_eval` | Evaluate policy rules                         |
| `gate`        | Check condition, fail plan if false           |

### 10.3 Deterministic Scheduler Rules

**Ordering**: Steps are executed in topological order of the dependency DAG.

**Concurrency**: For the kernel vertical slice, steps are executed sequentially in deterministic order. Parallel execution is an extension point.

**Deterministic tie-breaking**: When multiple steps have all dependencies satisfied, execute in lexicographic order of `step_id`.

**Algorithm**:

```text
ready = { s | s.depends_on == [] }
while ready is not empty:
    step = min(ready, key=step_id)  // lexicographic
    execute(step)
    record(step result)
    for each successor of step:
        if all deps satisfied:
            ready.add(successor)
```

### 10.4 Plan Run Result

```json
{
  "run_id": "H('plan:', canonical_json({plan_hash, logical_time, nonce}))",
  "plan_hash": "...",
  "steps_completed": 2,
  "steps_total": 2,
  "ok": true,
  "step_results": {
    "step-1": { "ok": true, "result_digest": "...", "duration_ns": 5000000 },
    "step-2": { "ok": true, "result_digest": "...", "duration_ns": 3000000 }
  },
  "receipt_hash": "H('rcpt:', canonical_json(run_receipt))"
}
```

---

## 11. Receipts

### 11.1 Generation

After every plan run (or individual exec), generate a receipt:

```json
{
  "receipt_version": 1,
  "run_id": "...",
  "plan_hash": "...",
  "request_digest": "...",
  "result_digest": "...",
  "step_digests": { "step-1": "...", "step-2": "..." },
  "event_log_seq": 42,
  "event_log_prev": "...",
  "receipt_hash": "H('rcpt:', canonical_json(this_without_receipt_hash))"
}
```

### 11.2 Verification

Given a receipt:

1. Re-compute `receipt_hash` from the receipt fields (excluding `receipt_hash` itself)
2. Verify `receipt_hash` matches
3. Look up `event_log_seq` in the event log
4. Verify the event log entry references the same `run_id` and `result_digest`

### 11.3 Replay Proof

```text
run_original → receipt_hash_A
replay(same plan, same inputs) → receipt_hash_B
ASSERT receipt_hash_A == receipt_hash_B
```

If they differ, the execution was non-deterministic — this is a FAIL condition.

---

## 12. Kernel vs View Layer Boundary

| Layer           | Responsibilities                                                                                  | Examples                             |
| --------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **Kernel**      | Encoding, hashing, CAS, event log, capabilities, policy eval, metering, plan scheduling, receipts | C++ engine library                   |
| **CLI Surface** | Parse args, call kernel, format output as envelope                                                | `requiem doctor`, `requiem plan run` |
| **API Surface** | HTTP route handling, request parsing, call kernel, envelope response                              | ReadyLayer API routes                |
| **View Layer**  | UI rendering, state management, user interaction                                                  | ReadyLayer React components          |

**Rule**: The view layer MUST NOT bypass the kernel. All mutations go through kernel functions. The view layer reads kernel state via CAS and event log queries.

---

## 13. Constants Summary

| Constant                   | Value | Location      |
| -------------------------- | ----- | ------------- |
| `ENGINE_ABI_VERSION`       | 2     | `version.hpp` |
| `HASH_ALGORITHM_VERSION`   | 1     | `version.hpp` |
| `CAS_FORMAT_VERSION`       | 2     | `version.hpp` |
| `PROTOCOL_FRAMING_VERSION` | 1     | `version.hpp` |
| `REPLAY_LOG_VERSION`       | 1     | `version.hpp` |
| `AUDIT_LOG_VERSION`        | 1     | `version.hpp` |
| `ENVELOPE_VERSION`         | 1     | NEW           |
| `CAPABILITY_VERSION`       | 1     | NEW           |
| `POLICY_VM_VERSION`        | 1     | NEW           |
| `RECEIPT_VERSION`          | 1     | NEW           |
| `PLAN_VERSION`             | 1     | NEW           |
| `BUDGET_VERSION`           | 1     | NEW           |

---

## 14. Invariants (Non-Negotiable)

1. **INV-HASH**: All digests use `HASH_ALGORITHM_VERSION=1` BLAKE3 with domain separation. No other hash function is accepted.
2. **INV-CHAIN**: Every event log entry's `prev` must equal `H("evt:", canonical_json(previous_entry))`. Breaking the chain is a fatal error.
3. **INV-CAS**: Every `get()` verifies `H("cas:", data) == digest`. Mismatch = quarantine + error.
4. **INV-CAPABILITY**: No privileged operation proceeds without a valid, non-revoked capability token.
5. **INV-METER**: Budget check occurs BEFORE the operation. Over-budget = hard deny, no partial work.
6. **INV-REPLAY**: `replay(same_inputs) → identical receipt_hash`. Any deviation is a FAIL.
7. **INV-ENVELOPE**: All CLI/API output is wrapped in the versioned envelope. Raw output is a spec violation.
8. **INV-NO-WALL-CLOCK**: The kernel uses logical time only. Wall-clock timestamps are metadata, not inputs to hashing or decisions.
9. **INV-DETERMINISTIC-SCHEDULE**: Plan steps execute in topological+lexicographic order. No randomness in scheduling.
10. **INV-NO-AMBIENT**: Ambient authority (global state, env vars, implicit credentials) is never used for authorization. Explicit tokens only.
