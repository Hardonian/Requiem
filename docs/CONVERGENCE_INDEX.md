# CONVERGENCE_INDEX.md

> Generated during Nuclear Audit

## Invariants

| Invariant                      | Specification           | Status                 | Fix Action Taken                                                                                                                                                           |
| ------------------------------ | ----------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **INV-HASH**                   | `KERNEL_SPEC.md` §14.1  | IMPLEMENTED            | Verified `third_party/blake3/` is exclusively used.                                                                                                                        |
| **INV-CHAIN**                  | `KERNEL_SPEC.md` §14.2  | IMPLEMENTED            | Event log properly maintains the hash chain using domain-separated BLAKE3 hashes.                                                                                          |
| **INV-CAS**                    | `KERNEL_SPEC.md` §14.3  | IMPLEMENTED            | `src/cas.cpp` validates on `get()`.                                                                                                                                        |
| **INV-CAPABILITY**             | `KERNEL_SPEC.md` §14.4  | PARTIAL                | Token logic exists in `src/caps.cpp` and `src/cli.cpp` (`cap mint`/`cap verify`), but ambient authority blocks are not universally enforced across all C++ kernel methods. |
| **INV-METER**                  | `KERNEL_SPEC.md` §14.5  | IMPLEMENTED            | `src/metering.cpp` and `economics.hpp` implemented.                                                                                                                        |
| **INV-REPLAY**                 | `KERNEL_SPEC.md` §14.6  | IMPLEMENTED            | `src/receipt.cpp` handles replay verification logic exactly.                                                                                                               |
| **INV-ENVELOPE**               | `KERNEL_SPEC.md` §14.7  | IMPLEMENTED            | Added missing escape logic in CLI strings previously causing JSON failures.                                                                                                |
| **INV-NO-WALLCLOCK**           | `KERNEL_SPEC.md` §14.8  | DRIFTED -> IMPLEMENTED | Found `timestamp_unix_ms` hashed into `snapshot_hash` and fixed by removing it. Event log uses only deterministic logical timestamps for chain hashes.                     |
| **INV-DETERMINISTIC-SCHEDULE** | `KERNEL_SPEC.md` §14.9  | IMPLEMENTED            | `src/plan.cpp` enforces deterministic DAG execution.                                                                                                                       |
| **INV-NO-AMBIENT**             | `KERNEL_SPEC.md` §14.10 | PARTIAL                | `caps.cpp` allows tokens, but they aren't fully wired into environment barriers on Windows.                                                                                |

## Primitives Map

| Primitive            | Module                                              | CLI Command                                            | Web Route        | Test                                        | Status                   |
| -------------------- | --------------------------------------------------- | ------------------------------------------------------ | ---------------- | ------------------------------------------- | ------------------------ |
| Canonical Encoding   | `src/jsonlite.cpp`                                  | Implicit                                               | Implicit         | `kernel_tests.cpp` (implicitly tested)      | IMPLEMENTED              |
| BLAKE3 Hash + Domain | `src/hash.cpp`                                      | `digest verify`                                        | N/A              | `domain_separation_no_collision`            | IMPLEMENTED              |
| Versioned Envelope   | `src/envelope.cpp`                                  | All CLI outputs                                        | `/api/*`         | `envelope_success`, `envelope_error`        | IMPLEMENTED              |
| EventLog chain       | `src/event_log.cpp`, `src/audit.cpp`                | `log verify`                                           | `/runs/*`        | `event_log_append_and_read` (Windows Fixed) | DUPLICATE -> IMPLEMENTED |
| CAS Content          | `src/cas.cpp`                                       | `cas put`, `cas info`, `cas verify`                    | `/api/cas/*`     | Used implicitly via CAS backend             | IMPLEMENTED              |
| Capability Tokens    | `src/caps.cpp`                                      | `cap mint`, `cap verify`                               | `/api/caps`      | `caps_mint_and_verify`                      | IMPLEMENTED              |
| Policy VM            | `src/policy_vm.cpp`                                 | `policy vm-eval`                                       | `/api/policy`    | `policy_eval_allow`                         | IMPLEMENTED              |
| Metering (Budget)    | `src/metering.cpp`, `include/requiem/economics.hpp` | `budget set`, `budget show`                            | `/api/metering`  | N/A                                         | PARTIAL                  |
| Plan Graph DAG       | `src/plan.cpp`                                      | `plan run`, `plan verify`, `plan hash`                 | `/api/plans`     | `plan_validate_ok`                          | IMPLEMENTED              |
| Execution Receipt    | `src/receipt.cpp`                                   | `receipt show`, `receipt verify`                       | `/api/receipts`  | `receipt_generate_and_verify`               | IMPLEMENTED              |
| Snapshots            | `src/snapshot.cpp`                                  | `snapshot create`, `snapshot list`, `snapshot restore` | `/api/snapshots` | N/A                                         | IMPLEMENTED              |
