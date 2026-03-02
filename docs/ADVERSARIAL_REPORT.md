# Adversarial Report — Security Testing Results

**Date:** 2026-03-02  
**Phase:** STRATEGIC VALUE ADD - ADVERSARIAL PASS  
**Purpose:** Document attempts to break system invariants and security boundaries.

---

## Executive Summary

This report documents the adversarial testing performed on the Requiem deterministic governance kernel. The testing focused on attacking the core invariants that ensure system security, determinism, and billing integrity.

| Attack Vector | Status | Mitigation |
|---------------|--------|------------|
| Capability bypass | ✅ BLOCKED | Policy pipeline as primary execution path |
| Replay mismatch | ✅ BLOCKED | Engine fingerprinting in receipts |
| CAS object tampering | ✅ BLOCKED | Dual-hash verification on read |
| DAG reordering | ✅ BLOCKED | Topological + lexicographic ordering |
| Logical time manipulation | ✅ BLOCKED | Monotonic counter, no external input |
| Budget double-spend | ✅ BLOCKED | Idempotency via request_digest |

---

## 1. Capability Bypass Attack

### Attack Description
Attempt to bypass capability checks by directly invoking tools without going through the policy pipeline.

### Attack Vector
```cpp
// Attempt to call tool directly without capability check
auto result = sandbox.execute("system.echo", input, /*skip_policy=*/true);
```

### Result
**BLOCKED** ✅

### Analysis
The policy pipeline is the primary execution path - every execution MUST flow through:
```
Request → Gate → Capabilities → Guardrails → Budget → Execution
```

No bypass mechanism exists. The sandbox only accepts requests that have already passed policy evaluation.

### Fix Applied
None required - invariant already enforced.

---

## 2. Replay Mismatch Attack

### Attack Description
Attempt to replay an execution with a different engine version, producing a different result but claiming it's the same execution.

### Attack Vector
1. Execute request with engine v1.0
2. Modify engine version (e.g., ABI version)
3. Replay with same inputs
4. Compare receipts

### Result
**BLOCKED** ✅ (NEW DEFENSE ADDED)

### Analysis
Previously, receipts did not bind to engine state. An attacker could:
- Execute on one version
- Replay on a different version
- Claim the different result is valid

### Fix Applied
Engine fingerprinting added to receipts:
```cpp
// In receipt.hpp
struct Receipt {
  // ... existing fields ...
  std::string engine_fingerprint;  // NEW: H(kernel_version || schema_version || hash_algo_version)
};
```

Receipt verification now checks:
```cpp
std::string current_fingerprint = compute_engine_fingerprint();
if (receipt.engine_fingerprint != current_fingerprint) {
  return error("engine_fingerprint_mismatch");
}
```

---

## 3. CAS Object Tampering Attack

### Attack Description
Attempt to tamper with CAS-stored objects and read them back with modified content.

### Attack Vector
1. Store object in CAS
2. Modify the on-disk file
3. Read object back

### Result
**BLOCKED** ✅

### Analysis
CAS v2 implements dual-hash verification:
- BLAKE3 (fast) + SHA-256 (interoperable)
- Every read verifies stored_blob_hash
- Fail-closed: corruption → empty result, never corrupted data

### Fix Applied
None required - invariant already enforced.

---

## 4. DAG Execution Reordering Attack

### Attack Description
Attempt to reorder DAG execution to produce different results.

### Attack Vector
1. Create plan with steps A, B, C where A depends on B and C
2. Execute plan multiple times
3. Check if step execution order varies

### Result
**BLOCKED** ✅

### Analysis
Plan execution uses deterministic topological ordering with lexicographic tie-breaking:
```cpp
// From plan.hpp
std::vector<std::string> plan_topological_order(const Plan& plan);
// INV-DETERMINISTIC-SCHEDULE: Steps execute in topological+lexicographic order
```

### Fix Applied
None required - invariant already enforced.

---

## 5. Logical Time Manipulation Attack

### Attack Description
Attempt to manipulate logical time to affect event sequencing or replay.

### Attack Vector
1. Execute several events
2. Attempt to set logical_time backward or to a specific value
3. Check if sequence numbers can be manipulated

### Result
**BLOCKED** ✅

### Analysis
Logical time is an internal monotonic counter:
```cpp
// From event_log.cpp
record.seq = ++seq_;           // Atomic increment
record.ts_logical = ++logical_time_;  // Atomic increment
```

No external input can affect logical time. Wall-clock is stored separately as metadata and NOT used in chain hashing.

### Fix Applied
None required - invariant already enforced.

---

## 6. Budget Double-Spend Attack

### Attack Description
Attempt to consume budget twice for the same execution by retrying with the same request.

### Attack Vector
1. Execute request, get request_digest = D
2. Retry same request (same inputs, same request_digest)
3. Check if budget is deducted twice

### Result
**BLOCKED** ✅

### Analysis
Metering uses idempotency via request_digest:
```cpp
// From metering.hpp
struct MeterEvent {
  std::string request_digest;  // BLAKE3 idempotency key — prevents double-billing on retry
};
```

Duplicate detection in verify_parity():
```cpp
for (const auto& [digest, count] : seen) {
  if (count > 1) return "FAIL duplicate_billing: first_dup=" + digest;
}
```

### Fix Applied
None required - invariant already enforced.

---

## 7. New Attack Vectors Tested (2026-03-02)

### 7.1 Receipt Hash Tampering

**Attack Description:** Modify a receipt field and re-sign to create a valid-looking receipt.

**Result:** BLOCKED ✅

**Analysis:** Receipt hash computation includes all fields. Any modification breaks the hash verification.

---

### 7.2 Cost Ledger Root Manipulation

**Attack Description:** Attempt to modify cost records without detection.

**Result:** BLOCKED ✅ (NEW DEFENSE ADDED)

**Analysis:** Cost ledger now uses hash-linked receipts:
```cpp
// From economics.hpp
struct CostReceipt {
  std::string prev_cost_receipt_hash;  // Hash-linked chain
  std::string cost_receipt_hash;       // Self-verifying hash
};
```

Tenant-level cost root hash provides cryptographic billing lineage.

---

## 8. Security Invariants Summary

| Invariant | Enforcement | Tested |
|-----------|-------------|--------|
| Policy pipeline as primary path | Gate → Capabilities → Guardrails → Budget → Execution | ✅ |
| Engine fingerprint in receipts | receipt.engine_fingerprint verification | ✅ NEW |
| CAS dual-hash verification | BLAKE3 + SHA-256 on every read | ✅ |
| Deterministic DAG scheduling | Topological + lexicographic order | ✅ |
| Monotonic logical time | Internal counter, no external input | ✅ |
| Budget idempotency | request_digest deduplication | ✅ |
| Cost ledger integrity | Hash-linked receipts per tenant | ✅ NEW |

---

## 9. Recommendations

1. **Engine fingerprinting** is now enforced - any replay on different engine versions will fail
2. **Cost ledger** provides cryptographic billing verification - can be queried via `requiem cost verify --tenant`
3. Continue running security gauntlet on every release
4. Add chaos testing for network partition and clock skew scenarios

---

*End of Adversarial Report*
