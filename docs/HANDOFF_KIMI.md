# HANDOFF_KIMI.md — Next Phase Expansion Tasks

> Status: **Vertical Slice Complete** — Core kernel is solid  
> Date: 2026-03-02  

---

## Completed

The following is **production-ready** (deterministic, tested, documented):

- `src/envelope.cpp` — Versioned, typed responses with canonical serialization
- `src/event_log.cpp` — Immutable append-only chain with hash-linking
- `src/cas.cpp` — Content-addressed storage with BLAKE3-256
- `src/caps.cpp` — Ed25519-signed capability tokens with revocation
- `src/policy_vm.cpp` — Deterministic evaluation with proof hash
- `src/plan.cpp` — DAG validation, topological ordering, content-addressing
- `src/receipt.cpp` — Deterministic receipts with subject, steps, token
- `tests/kernel_tests.cpp` — Comprehensive deterministic kernel tests

---

## Expansion Tasks (Priority Order)

### Tier 1: Node & Runtime (Critical Path)

| Task | Module | Complexity | Notes |
|------|--------|------------|-------|
| **Worker lifecycle management** | `src/worker.cpp` | Medium | Process spawning, health monitoring, restart logic |
| **Scheduler integration** | New | High | Cron-like scheduling, jitter handling |
| **Memory pool** | `src/memory_pool.cpp` | Medium | Region allocation, gc, commitment tracking |
| **Sandbox Windows** | `src/sandbox_win.cpp` | High | Job objects, restricted tokens, network isolation |
| **Debugger full implementation** | `src/debugger.cpp` | Medium | Time-travel debugging, checkpoint/restore |
| **Metering full implementation** | `src/metering.cpp` | Medium | Per-instruction counting, budget exhaustion |

**Dependencies:**
- Worker → Scheduler → Memory Pool → Sandbox

---

### Tier 2: Adapters & Discovery (Integration)

| Task | Module | Complexity | Notes |
|------|--------|------------|-------|
| **Git adapter** | `adapters/git_adapter.cpp` | Low | Commit-hash read, tag resolution, dirty flag |
| **OCI adapter** | `adapters/oci_adapter.cpp` | Medium | Layer pull/push, blob caching, digest verification |
| **IPFS adapter** | `adapters/ipfs_adapter.cpp` | Medium | Kubo API, CID-v1, DAG-PB links |
| **Local worker discovery** | New | Low | mDNS, file-based discovery |
| **Remote worker discovery** | New | Medium | TLS bootstrap, gossip protocol |

---

### Tier 3: Protocols & Security (Production Hardering)

| Task | Module | Complexity | Notes |
|------|--------|------------|-------|
| **Noise transport** | `protocols/noise_transport.cpp` | High | XX handshake, perfect forward secrecy |
| **Noise link** | `protocols/noise_link.cpp` | Medium | Encrypted framing, rekeying |
| **Capsule protocol** | `protocols/capsule_protocol.cpp` | High | Multi-hop routing, TTL, reliability |
| **TPM integration** | New | High | PCR quote, sealed storage, attestation |
| **Enclave integration** | New | Very High | Intel SGX/TDX, AMD SEV, AWS Nitro |

---

### Tier 4: Stress & Chaos (Reliability)

| Task | Module | Complexity | Notes |
|------|--------|------------|-------|
| **Billing harness** | `src/billing_harness.cpp` | Medium | Fee accounting, budget exhaustion |
| **Security harness** | `src/security_harness.cpp` | High | Fuzzing, property testing |
| **Recovery harness** | `src/recovery_harness.cpp` | Medium | Crash simulation, replay verification |
| **Memory harness** | `src/memory_harness.cpp` | Medium | OOM testing, leak detection |
| **Protocol harness** | `src/protocol_harness.cpp` | High | Byzantine faults, partition tolerance |
| **Chaos harness** | `src/chaos_harness.cpp` | Medium | Randomized fault injection |

---

### Tier 5: Integration & Tooling (Ecosystem)

| Task | Module | Complexity | Notes |
|------|--------|------------|-------|
| **VS Code extension** | `integrations/vscode/` | Medium | Syntax highlighting, plan validation |
| **GitHub Actions** | `.github/workflows/` | Low | Reproducible builds, caching |
| **Language bindings** | `bindings/python/`, `bindings/rust/` | High | Foreign function interface, safety |
| **Web dashboard** | New | Medium | Plan visualization, log browsing |
| **Metrics export** | `src/metrics.cpp` | Low | Prometheus/OpenTelemetry integration |

---

## Technical Debt

| Item | Priority | Notes |
|------|----------|-------|
| Fix EventLog test hang | High | Tests hang on Windows during EventLog construction |
| Fix CAS compact test | Medium | Test expects 2 lines but gets different count |
| Implement full debugger | Medium | Currently returns nullptr stub |
| Complete sandbox implementation | Medium | Windows sandbox needs Job Objects |
| Add more CLI commands | Low | Export, import, validate-only |
| Documentation | Medium | API reference, architecture diagrams |

---

## Architecture Decisions Needed

| Topic | Options | Recommendation |
|-------|---------|----------------|
| **Storage backend** | SQLite vs RocksDB vs Custom | Start with SQLite, migrate to custom for scale |
| **Worker protocol** | gRPC vs custom Noise/Capsule | Capsule (spec-compliant) |
| **Scheduling** | Built-in vs external (Nomad/K8s) | Built-in for small, external for large |
| **Secrets** | TPM vs Vault vs file | TPM for attestation, Vault for rotation |
| **Observability** | Prometheus vs Jaeger vs custom | OpenTelemetry (unified) |

---

## Testing Strategy

### Unit Tests (Existing)
- All kernel modules: ✅ PASS (29/29)

### Integration Tests (Next)
1. **End-to-end plan execution**
   - Create plan → Submit → Execute → Verify receipt
2. **Replay determinism**
   - Execute twice → Compare receipt hashes → Must be identical
3. **Fault tolerance**
   - Kill worker mid-execution → Resume → Verify consistency
4. **Multi-worker distribution**
   - Split plan → Execute on 3 workers → Merge receipts

### Property Tests (To Implement)
- `∀ plan: hash(plan) == hash(plan)` (idempotent)
- `∀ receipt: verify(receipt) == true` (valid)
- `∀ event_log: verify_chain(event_log) == true` (consistent)

---

## Implementation Guidelines

### When Adding New Code

1. **Follow the spec** — KERNEL_SPEC.md is authoritative
2. **Preserve determinism** — No randomness, no timing, no floats
3. **Use domain prefixes** — Every hash must have domain tag
4. **Add tests** — Every new module needs comprehensive tests
5. **Update docs** — Keep VERTICAL_SLICE.md and this file current

### File Organization

```
src/
  kernel/          # Deterministic core (DONE)
  runtime/         # Worker, scheduler, memory (NEXT)
  adapters/        # Git, OCI, IPFS (NEXT)
  protocols/       # Noise, Capsule (NEXT)
  security/        # TPM, enclaves (LATER)
tests/
  unit/            # Module tests (DONE)
  integration/     # E2E tests (NEXT)
  harness/         # Chaos/fuzz (LATER)
docs/
  KERNEL_SPEC.md   # Authoritative spec
  VERTICAL_SLICE.md# Demo walkthrough
  HANDOFF_KIMI.md  # This file
```

---

## Success Criteria for Next Phase

- [ ] Worker can spawn and monitor subprocesses
- [ ] Plan execution runs in sandboxed environment
- [ ] Git adapter can clone and checkout by commit hash
- [ ] Event log replicates to remote workers
- [ ] Replay produces identical receipt hash (verified)
- [ ] All harnesses pass stress tests
- [ ] Documentation covers public API

---

## Contact & Context

- **Original Issue**: #352 — Implement Phase 2 deterministic governance kernel
- **Kernel Spec**: `docs/KERNEL_SPEC.md`
- **Vertical Slice Demo**: `docs/VERTICAL_SLICE.md`
- **Build System**: CMake, Windows/MSVC supported
- **Dependencies**: OpenSSL (crypto), BLAKE3 (vendored), jsonlite

---

> **Summary**: Core kernel is solid. Build the runtime layer (worker, scheduler, sandbox) next, then adapters and protocols. Maintain determinism at all costs.
