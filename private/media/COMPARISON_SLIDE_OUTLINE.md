# Comparison Slide Outline: Requiem / Zeo

## 📑 Slide Outline: Problem/Solution/Verification

### Slide 1: The AI Observability Gap
- **Problem**: "We logged it, but we can't prove it. We can't replay it. We don't know if it's deterministic."
- **Current State**: Fragmented logs, brittle prompts, hope-based governance.

### Slide 2: Requiem: The Provable AI Runtime
- **Solution**: "A first-class computing primitive for AI execution governance."
- **Core Guarantees**:
  - **Provable**: BLAKE3-v1 Hashing.
  - **Enforced**: Deny-by-default Gates.
  - **Replayable**: Dual-hash CAS v2.

### Slide 3: How This Differs from GHA + OPA
- **GHA**: Workflow-based (Time).
- **OPA**: Post-process or Middleware (Policy).
- **Requiem**: Execution-level Governance (Determinism).

### Slide 4: High-ROI Drift Taxonomy
- **The taxonomy**: Model / Prompt / Policy / Context / Eval / Runtime.
- **Value**: "Detect exactly what changed in the semantic state machine."

### Slide 5: Enterprise Ready (Designed to Support)
- **Compliance**: SOC 2, HIPAA, GDPR.
- **Performance**: High-throughput Native Engine (C++).
- **Security**: mTLS-v1, mTLS-v2, AES-256.

### Slide 6: Summary / Call to Action
- **One sentence**: "Every decision. Provable. Replayable. Enforced."
- **Link**: <https://github.com/reachhq/requiem> [Placeholder - REPLACE WITH ACTUAL]
- **Tenant ID**: "Scan the fingerprint for verification."
- **Slogan**: "Get the Green."
