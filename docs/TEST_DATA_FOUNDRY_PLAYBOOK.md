# Zeo Test Data Foundry: Playbook

**Version:** 1.0  
**Status:** IMPLEMENTATION DRAFT  
**Focus:** Governance, Repeatability, No Paid APIs  

---

## 1. Mission Statement
Test data is not a byproduct; it is **Decision Infrastructure**. 

To prevent entropy in Zeo, we must move from "lucky testing" to **deterministic fabrication**. Every byte of test data must be traceable to a seed, labeled for its failure mode, and hashed for ledger integrity.

---

## 2. Dataset Catalog

### A. Security & Policy (High Severity)
| Category | Scope | Generation Technique |
| :--- | :--- | :--- |
| **Policy Violation** | AuthZ / Tenant Isolation | Cross-product of `Roles` x `Tools` x `Tenant IDs` using static schemas. |
| **Prompt Injection** | Adversarial Agents | Template-based expansion of classic jailbreaks (Base64, Roleplay, Payload Splitting). |
| **Permission Escalation** | Capability Bypass | Session-ID manipulation simulations and token-ghosting traces. |

### B. Structural Integrity (Medium Severity)
| Category | Scope | Generation Technique |
| :--- | :--- | :--- |
| **Tool Misuse** | Schema Compliance | Combinatorial fuzzing of `inputSchema` (Type swaps, null-injection, overflow strings). |
| **Repo Lineage** | DAG & History | Scripted `git` simulations producing deterministic commit SHAs and dependency cycles. |

### C. Operational Performance (Low Severity)
| Category | Scope | Generation Technique |
| :--- | :--- | :--- |
| **CLI Run Traces** | Functional Replay | Capturing full `stdin`/`stdout`/`stderr` + signals (`SIGINT`) for non-interactive flows. |
| **Latency/Perf** | Regression Corpora | Synthetic large-scale state trees (10k+ nodes) and deep recursion stacks. |

---

## 3. The Foundry Lifecycle

### Step 1: Deterministic Sourcing (`Seed -> Input`)
Every dataset MUST be generated from a set of **Deterministic Seeds**.
- **Seed Source**: Project-level seed file or `dataset_id`-derived entropy.
- **No Randomness**: Replace `Math.random()` with a seeded LCG (Linear Congruential Generator).
- **Templates**: Use Mustache/Handlebars templates stored in `testdata/templates/`.

### Step 2: Labeling & Schema (`Input -> Label`)
Labels must be **minimal, clear, and auditable**.
- **Naming Pattern**: `[CATEGORY]_[SCENARIO]_[SEVERITY]` (e.g., `POL_TENANT_CROSS_HIGH`).
- **Audit Field**: Every item includes `label_justification` explaining why this specific input triggers the expected outcome.

### Step 3: Evaluation Metrics (`Input -> Outcome`)
Instead of `assertEquals`, we use **Parity Signals**:
1. **Decision Parity**: `actual_outcome === expected_outcome` (Boolean).
2. **Audit Parity**: Jaccard similarity between expected vs actual event log keys.
3. **Drift Logic**: % change in `result_digest` frequency over 100 metamorphic variations.

### Step 4: Storage & Hashing Strategy
| Artifact | Format | Purpose |
| :--- | :--- | :--- |
| **Registry** | `NDJSON` | Human-readable, Git-diff friendly ledger of items. |
| **Blobs** | `Parquet` | Efficient storage for multi-GB CLI traces and perf telemetry. |
| **Hashes** | `SHA256` | `item_id = h(seed + input_schema)`; `outcome_id = h(result_digest)`. |

---

## 5. Staged Roadmap

### v1: Manual Seeds & Goldens (Current Week)
- Hard-coded seed lists in JSON.
- Implementation of the first 10 datasets.
- Integration with `scripts/generate_golden_corpus.sh`.

### v2: Semi-automated Fabrication (Month 1)
- CLI command: `requiem foundry fabricate --type VECTORS --count 100`.
- Rule-based auto-labeling (e.g., "Any path with `..` is labeled `ADV_PATH_TRAVERSAL`").
- Automated "Metamorphic Shuffling": Take a valid request, flip one bit, expect failure.

### v3: Continuous Drift Loop (Month 3)
- CI gate for "Semantic Drift".
- Failure if the **statistical distribution** of failure modes changes significantly between commits.
- Automated "Regression Archive": Failed items in CI are auto-added to the v2 fabrication seeds.

---

## 6. First 10 Datasets (Implementation Checklist)

1. **`POL-TENANT-ISOLATION`**: 10 cross-tenant read attempts via `junctions_scan`.
2. **`POL-ROLE-ESCALATION`**: `viewer` role attempting `cluster_shutdown`.
3. **`TOOL-SCHEMA-STRESS`**: 50 tool calls with swapped parameter types (string vs number).
4. **`ADV-INJECT-BASIC`**: Top 10 classic jailbreak payloads in `system.echo`.
5. **`ADV-PATH-TRAVERSAL`**: 5 variations of `../../../etc/passwd` injection in workspace paths.
6. **`REPO-DAG-CIRCULAR`**: A 5-node git dependency graph with a deliberately injected cycle.
7. **`CLI-PIPE-PRESSURE`**: Routing 10MB of synthetic log data through the CLI with `--minimal`.
8. **`PERF-COLD-START`**: 5 runs of `system.health` to baseline binary load time.
9. **`FAULT-OOM-SCENARIO`**: Large memory-state request (100MB state tree) to trigger limits.
10. **`TRACE-ROUNDTRIP`**: `run -> receipt -> replay` cycle ensuring 100% bit-parity in results.

---

## 7. Implementation Notes
- **No Paid APIs**: All adversarial vectors are sourced from open-source repositories (e.g., OWASP, JailbreakChat) and stored locally as templates.
- **Environment Parity**: The foundry must run identical seeds on Windows, Linux, and MacOS to detect platform-specific divergence.
