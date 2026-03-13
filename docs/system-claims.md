# System Claims Registry

> Machine-verifiable inventory of every guarantee Requiem claims.
> Each claim must be backed by automated tests or removed from documentation.

---

## CLAIM_DETERMINISM

| Field | Value |
|---|---|
| claim_id | `CLAIM_DETERMINISM` |
| description | For any two executions of the same canonical request, `result_digest` is byte-for-byte identical regardless of time, order, worker, platform, or number of prior executions. |
| source | `docs/INVARIANTS.md` (INV-1), `docs/CONTRACT.md`, `docs/KERNEL_SPEC.md` (INV-REPLAY), `README.md` |
| expected_invariant | `hash(output_state) == hash(replay_state)` for all N replays |
| verification_strategy | Deterministic replay harness: record workflow, replay N times, compare final state hashes. CI gate: 200x sequential + 3-worker concurrent. |
| test_path | `/tests/determinism/` |
| status | **ENFORCED** |

---

## CLAIM_CAS_IMMUTABILITY

| Field | Value |
|---|---|
| claim_id | `CLAIM_CAS_IMMUTABILITY` |
| description | Once a CAS object is stored under a digest key, its content is immutable. A digest key always returns the same bytes or `cas_integrity_failed`. Silent mutation is a critical invariant violation. |
| source | `docs/INVARIANTS.md` (INV-2), `docs/CAS.md`, `docs/KERNEL_SPEC.md` (INV-CAS) |
| expected_invariant | `H("cas:", get(digest)) == digest` on every read |
| verification_strategy | Store object, verify on read, attempt mutation (must fail), duplicate insertion (idempotent), GC with active references (must retain). |
| test_path | `/tests/cas/` |
| status | **ENFORCED** |

---

## CLAIM_HASH_CANONICAL

| Field | Value |
|---|---|
| claim_id | `CLAIM_HASH_CANONICAL` |
| description | BLAKE3-256 is the sole hash primitive. Domain separation prevents cross-context collisions. Canonical JSON serialization produces stable, sorted, whitespace-free output. Cross-language (TS/C++) parity is required. |
| source | `docs/KERNEL_SPEC.md` (INV-HASH), `docs/CONTRACT.md`, `src/hash.cpp`, `packages/core/src/hash.ts` |
| expected_invariant | `blake3_hex_ts(input) == blake3_hex_cpp(input)` for all inputs |
| verification_strategy | Cross-language parity tests with identical inputs producing identical 64-char hex digests. |
| test_path | `/tests/hash-parity/` |
| status | **ENFORCED** |

---

## CLAIM_EVENT_CHAIN_INTEGRITY

| Field | Value |
|---|---|
| claim_id | `CLAIM_EVENT_CHAIN_INTEGRITY` |
| description | The EventLog is an immutable, append-only audit trail. Each record's `prev` field contains `H("evt:", canonical_json(previous_record))`. Genesis uses `prev = "0" * 64`. |
| source | `docs/KERNEL_SPEC.md` (INV-CHAIN), `docs/ARCHITECTURE.md`, `docs/SECURITY.md` |
| expected_invariant | `event[n].prev == H("evt:", canonical_json(event[n-1]))` for all n > 0 |
| verification_strategy | Build event chain, verify linkage, attempt insertion of forged record (must fail), verify Merkle root covers entire history. |
| test_path | `/tests/determinism/event-chain.test.ts` |
| status | **ENFORCED** |

---

## CLAIM_POLICY_DETERMINISM

| Field | Value |
|---|---|
| claim_id | `CLAIM_POLICY_DETERMINISM` |
| description | Policy evaluation is deterministic: `policy(input) → decision` produces identical output for identical inputs. Deny-by-default when no rule matches. |
| source | `docs/INVARIANTS.md` (INV-14), `docs/POLICY.md`, `docs/KERNEL_SPEC.md` (INV-METER) |
| expected_invariant | `hash(policy_decision_1) == hash(policy_decision_2)` for identical inputs |
| verification_strategy | Evaluate policy N times with same inputs, verify `decision_hash`, `proof_hash`, and `context_hash` are identical across all evaluations. |
| test_path | `/tests/policy/` |
| status | **ENFORCED** |

---

## CLAIM_REPLAY_EQUIVALENCE

| Field | Value |
|---|---|
| claim_id | `CLAIM_REPLAY_EQUIVALENCE` |
| description | `replay(same_inputs) → identical receipt_hash`. Any deviation is a FAIL. Replay reconstructs inputs, policy state, tool responses, and execution graph. |
| source | `docs/KERNEL_SPEC.md` (INV-REPLAY), `docs/REPLAY_SYSTEM.md`, `README.md` |
| expected_invariant | `replay_digest == original_digest` |
| verification_strategy | Record execution, replay from proof pack, compare step hashes, policy hashes, and final state hash. |
| test_path | `/tests/determinism/replay.test.ts` |
| status | **ENFORCED** |

---

## CLAIM_CRASH_SURVIVABILITY

| Field | Value |
|---|---|
| claim_id | `CLAIM_CRASH_SURVIVABILITY` |
| description | System survives crashes during CAS writes, WAL appends, proof generation, and workflow steps without losing state integrity or workflow history. |
| source | `docs/KERNEL_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md` |
| expected_invariant | After crash + restart: `verify_event_chain(events).ok == true` AND `verify_cas_integrity().ok == true` |
| verification_strategy | Inject crashes mid-operation (CAS write, WAL append, proof gen, workflow step). Restart system. Verify state integrity, no lost history, replay recovery. |
| test_path | `/tests/crash/` |
| status | **ENFORCED** |

---

## CLAIM_AUDIT_APPEND_ONLY

| Field | Value |
|---|---|
| claim_id | `CLAIM_AUDIT_APPEND_ONLY` |
| description | Audit log entries are never deleted, overwritten, or reordered. The log is strictly append-only. Any read of a past entry at index N returns the same value for the lifetime of the system. |
| source | `docs/INVARIANTS.md` (INV-6), `docs/SECURITY.md` |
| expected_invariant | `audit_log[N] == audit_log[N]` for all reads, `length(audit_log)` is monotonically non-decreasing |
| verification_strategy | Append entries, verify reads return same values, attempt delete/overwrite (must fail). |
| test_path | `/tests/determinism/audit-append-only.test.ts` |
| status | **ENFORCED** |

---

## CLAIM_BUDGET_BEFORE_EXECUTION

| Field | Value |
|---|---|
| claim_id | `CLAIM_BUDGET_BEFORE_EXECUTION` |
| description | Budget check occurs BEFORE the operation. Over-budget results in hard deny with no partial work. Every metered operation produces a receipt. |
| source | `docs/KERNEL_SPEC.md` (INV-METER), `docs/INVARIANTS.md` (INV-16), `docs/CONTRACT.md` |
| expected_invariant | `budget_check(op) == deny → side_effects(op) == 0` |
| verification_strategy | Exhaust budget, attempt operation, verify no side effects occurred. |
| test_path | `/tests/policy/budget.test.ts` |
| status | **ENFORCED** |

---

## CLAIM_NO_WALL_CLOCK

| Field | Value |
|---|---|
| claim_id | `CLAIM_NO_WALL_CLOCK` |
| description | The kernel uses logical time only. Wall-clock timestamps are metadata, not inputs to hashing or decisions. |
| source | `docs/KERNEL_SPEC.md` (INV-NO-WALL-CLOCK), `docs/INVARIANTS.md` (INV-9) |
| expected_invariant | `hash(execution_with_time_A) == hash(execution_with_time_B)` when only wall-clock differs |
| verification_strategy | Execute identical workflows at different wall-clock times, verify result digests match. |
| test_path | `/tests/determinism/no-wall-clock.test.ts` |
| status | **ENFORCED** |

---

## CLAIM_CAPABILITY_GATING

| Field | Value |
|---|---|
| claim_id | `CLAIM_CAPABILITY_GATING` |
| description | No ambient authority. Every privileged operation requires a valid, non-revoked capability token. Revocation is permanent. |
| source | `docs/KERNEL_SPEC.md` (INV-CAPABILITY, INV-NO-AMBIENT) |
| expected_invariant | `execute_privileged(no_token) → ErrorCode::capability_required` |
| verification_strategy | Attempt privileged ops without token (must fail), with revoked token (must fail), with valid token (must succeed). |
| test_path | `/tests/policy/capability.test.ts` |
| status | **ENFORCED** |

---

## CLAIM_PROOFPACK_VALIDITY

| Field | Value |
|---|---|
| claim_id | `CLAIM_PROOFPACK_VALIDITY` |
| description | Proofpacks are self-validating execution receipts. `requiem verify proofpack.json` returns VALID or INVALID. Merkle root covers all execution digests. |
| source | `docs/PROOF_SYSTEM.md`, `docs/PROOF_DEPENDENCY_MODEL.md` |
| expected_invariant | `verify(build_proofpack(execution)) == VALID` |
| verification_strategy | Generate proofpack from execution, verify all fields, tamper with fields and verify detection. |
| test_path | `/packages/proofs/`, `/tests/determinism/proofpack.test.ts` |
| status | **ENFORCED** |

---

## CLAIM_DETERMINISTIC_SCHEDULE

| Field | Value |
|---|---|
| claim_id | `CLAIM_DETERMINISTIC_SCHEDULE` |
| description | Plan steps execute in topological+lexicographic order. No randomness in scheduling. |
| source | `docs/KERNEL_SPEC.md` (INV-DETERMINISTIC-SCHEDULE) |
| expected_invariant | `schedule(dag) == schedule(dag)` for all invocations |
| verification_strategy | Build DAG with multiple valid orderings, verify same topological+lexicographic order is always chosen. |
| test_path | `/tests/determinism/schedule.test.ts` |
| status | **ENFORCED** |

---

## CLAIM_STRUCTURED_ERRORS

| Field | Value |
|---|---|
| claim_id | `CLAIM_STRUCTURED_ERRORS` |
| description | All errors use RequiemError or subclasses. All API routes return structured JSON error bodies. No raw Error throws in production. |
| source | `docs/INVARIANTS.md` (INV-3, INV-7) |
| expected_invariant | Every error response contains `{ code, message, traceId }` |
| verification_strategy | Trigger error conditions across API surface, verify structured envelope. |
| test_path | `/tests/determinism/structured-errors.test.ts` |
| status | **ENFORCED** |

---

## CLAIM_TENANT_ISOLATION

| Field | Value |
|---|---|
| claim_id | `CLAIM_TENANT_ISOLATION` |
| description | Tenant derivation is always server-side. Client input is never trusted for tenant identification. |
| source | `docs/INVARIANTS.md` (INV-4), `docs/SECURITY.md` |
| expected_invariant | `resolve_tenant(forged_header) != forged_tenant_id` |
| verification_strategy | Attempt tenant spoofing via headers, verify server-side resolution overrides. |
| test_path | `/tests/policy/tenant-isolation.test.ts` |
| status | **ENFORCED** |
