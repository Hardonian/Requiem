# SR&ED Technical Narrative: Deterministic AI Runtime

**Project Title**: Development of a Deterministic, Provable Runtime for Nondeterministic AI Agent Execution.

## 1. Technical Objectives
The goal of this research project is to create a computing environment where the inherently stochastic nature of Large Language Models (LLMs) can be constrained and verified through a deterministic execution layer. This requires achieving 100% bit-perfect replayability of AI agent states across heterogeneous compute environments.

## 2. Technical Uncertainty
The primary uncertainty stems from the "Noise" inherent in modern operating systems and model provider APIs. 
- **Environmental Drift**: Standard process environments leak data (PIDs, Timestamps, Temp files) into the execution context, which corrupts the content-addressable hash.
- **Provider Stochasticity**: Model providers (OpenAI, etc.) may change underlying hardware or software weights without notice, causing identical tokens to yield different semantic outcomes.
- **Serialization Conflict**: Standard JSON/Object serialization is not stable across different runtime versions (Node vs. Bun vs. Native), breaking the Merkle chain.

## 3. Technology Advancement
Our research has yielded several advancements in state-machine governance:
1. **Domain-Separated Hashing for AI**: Implementation of a BLAKE3-based domain separation protocol that uniquely identifies the "Intent," "Context," and "Policy" of an AI invocation as distinct semantic layers.
2. **Canonical State Reconstitution**: A method for stripping environmental entropy from a child process and injecting a synthesized, stable environment that maintains bit-perfection across re-runs.
3. **Policy VM Gate**: A custom virtual machine (VM) designed specifically for the high-frequency evaluation of governance rules within the request-response loop of an LLM.

## 4. Work Performed
- **Prototype A**: Implementation of a baseline logging system (Failed to provide provability; susceptible to text-drift).
- **Prototype B**: Built-in Python sandboxing (Failed due to excessive latency and non-deterministic object IDs).
- **Current Architecture**: Native C++ engine using restricted namespaces and canonical byte-level serialization.

## 5. Technical Challenges Encountered
- **Memory Layout Randomization**: ASLR in Linux/Windows kernels causes memory-referencing pointers in logs to change between runs. Solution: Abstracted pointer-safe logging protocols.
- **Floating Point Consistency**: Mathematical ops in some local LLMs vary slightly by CPU architecture. Solution: Hardware-aware fingerprinting.
