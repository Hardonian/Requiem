# Trace Analytics — Requiem Agent Observation

Projections and normalization rules for analyzing agent reasoning traces and tool execution efficiency.

## 1. Trace Normalization Rules

To ensure deterministic analysis of traces across different models, the following normalization must be applied:

*   **Timestamp Alignment**: All trace events must be normalized to UTC ISO-8601.
*   **ID Anonymization**: Replace sensitive resource IDs with deterministic hashes (`SHA-256(ResourceID + Salt)`) for multi-tenant analytics.
*   **Result Compaction**: Truncate tool output blobs > 1KB, preserving only the BLAKE3 digest for validation.

## 2. Inefficiency Metrics

### Reasoning Overhead (RO)
The cost of internal reasoning vs. external action:

$$ RO = \frac{\text{Internal Reasoning Tokens}}{\text{Tool Call Count}} $$
*Target: < 200 tokens/action*

### Tool Ping-Pong (TPP)
Detects redundant information gathering:

$$ TPP = \frac{\text{Repeated Tool Methods}}{\text{Total Actions}} $$
*Target: < 0.05*

## 3. Step Clustering Logic

Reasoning steps should be clustered into "Outcome-Driven Intent" blocks:

1.  **Gathering Phase**: Series of `read`/`scan` tools.
2.  **Analysis Phase**: Internal model reasoning (no tool calls).
3.  **Execution Phase**: Series of `write`/`decide` tools.
4.  **Verification Phase**: Final `check`/`validate` tools.

## 4. Future Metrics Proposals

*   **Logic Drift Score**: Measure deviation in reasoning steps between same input requests on different model versions.
*   **Entropy Contribution**: Bits of information gained per tool call vs. total trace length.

---
**Status**: PROPOSAL - Aligned with Antigravity principles.
