# Competitive Landscape: Requiem

## 1. Direct Comparisons

### Requiem vs. GitHub Actions + OPA
- **GHA + OPA**: Focuses on *structural* pipeline security. Can check if a config is valid.
- **Requiem**: Focuses on *semantic* execution integrity. Checks what the AI *actually did* in the moment. It provides cryptographic receipts of the run itself, not just the code that initiated it.

### Requiem vs. Workflow Engines (Temporal, Dagster, Prefect)
- **Workflow Engines**: Focus on "durable execution" and state persistence. They ensure a job finishes eventually.
- **Requiem**: Focuses on "verifiable execution." We don't just ensure it finishes; we ensure it was *correct*, *deterministic*, and *compliant* at every step.

### Requiem vs. Prompt Ops (LangSmith, Weights & Biases)
- **Prompt Ops**: Focuses on visibility, evaluation, and latency monitoring.
- **Requiem**: Focuses on enforcement and proof. While LangSmith *watches* what happens, Requiem *governs* what is allowed to happen and creates a verifiable proof of the result.

## 2. Key Differentiators Table

| Feature | GHA/OPA | Temporal | Prompt Ops | Requiem |
|---------|---------|----------|------------|---------|
| **Determinism Proof** | No | Partially | No | **Yes (BLAKE3)** |
| **CAS Dual-Hash** | No | No | No | **Yes (v2)** |
| **Replay Verification** | No | Yes (Logic) | No | **Yes (Byte-level)** |
| **Deny-by-Default CLI**| Yes | No | No | **Yes (Reach)** |
| **Formal TLA+ Specs** | No | Yes | No | **Yes** |

## 3. The "Unfair Advantage"
Requiem’s integration of **Formal Verification (TLA+)** with a **High-Performance Native Engine (C++)** allows us to make guarantees that software-only wrappers cannot. We provide "Hardware-grade" trust for "Software-level" AI agents.

## 4. Market Segments
- **FinTech**: Compliance receipts for automated trading or advice.
- **GovTech**: Provable neutrality and policy adherence in automated systems.
- **Cloud Infrastructure**: Scalable, high-integrity sandboxes for untrusted agent code.
