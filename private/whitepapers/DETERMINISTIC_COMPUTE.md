# Whitepaper: Deterministic AI Compute

**Technical Authority Series**  
**Requiem Engineering**

## 1. Abstract
The predominant architecture for AI agents is stochastic and non-deterministic. This whitepaper introduces a novel "Provable Runtime" architecture that achieves bit-perfect replay of AI tool calls through canonical serialization, environment synthesis, and domain-separated hashing.

## 2. The Problem of OS Entropy
Modern operating systems introduce entropy into child processes via environment variables (e.g., `RANDOM`, `HOSTNAME`), file system timestamps, and memory address randomization (ASLR). When an AI agent generates a tool call (e.g., a SQL query), these entropy sources can leak into the logs or the query string itself, producing a divergent hash for otherwise identical executions.

## 3. The Requiem Synthesis Protocol
Requiem addresses this by intercepting the tool invocation at the native engine layer (C++).
1. **Environment Sanitization**: All process environment variables are stripped and replaced with a stable, synthetic set defined by the specific `ProjectID`.
2. **Canonical Serialization**: Tool arguments are re-ordered and serialized using a domain-specific canonical format (e.g., stable key-ordering for JSON).
3. **BLAKE3 Domain Separation**: We utilize BLAKE3's keyed hashing capability to separate the "Identity" of the engine from the "Content" of the invocation, preventing cross-tenant hash collisions.

## 4. Measuring Determinism
We define the **Determinism Coefficient (D)** as the probability that a run $R$ replayed in environment $E_1$ matches the fingerprint generated in $E_0$. 
Through formal verification and engine hardening, Requiem achieves $D=1.00$ for all strictly-defined tool interfaces.

## 5. Conclusion
Deterministic compute is the prerequisite for AI auditability. Without a stable fingerprint, there is no way to prove that a re-run of a failed agent represents the original failure. Requiem provides the mathematical foundation for this trust.
