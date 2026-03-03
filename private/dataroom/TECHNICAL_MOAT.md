# Technical Moat Analysis: Requiem

**Version**: 1.0.0  
**Last Updated**: 2026-03-02

## 1. The "Determinism First" Architecture

Requiem's primary moat is the **Native Engine**. Retrofitting 100% determinism into a high-level framework (like LangChain) is structurally impossible due to the thousands of "noise" sources in standard Python/Node environments.

## 2. BLAKE3 Domain-Separated Hashing

We utilize BLAKE3 with strict domain separation for every layer of the stack:

- **Inputs**: Sanitized and canonically serialized.
- **Rules**: Immutable policy hashes.
- **Transitions**: State hashes that form a Merkle trace.

## 3. Policy VM as a Runtime Gate

Our Policy VM is not a "wrapper"—it is the **Process Supervisor**. If a tool call fails the policy check, the C++ engine physically prevents the execution request from leaving the sandbox. This level of security is difficult to achieve in pure-JS/Python frameworks.

## 4. CAS v2 Integrity

Our Content-Addressable Storage (CAS) uses dual-hashing (BLAKE3 + SHA-256) to prevent collisions and ensure that what you replayed in 2025 is *identically verifiable* in 2030, regardless of changes in the underlying model providers.

## 5. Proprietary IP Surfaces

- **Canonical Serialization Logic**: Specific to AI execution graphs.
- **Drift Taxonomy Algorithms**: Automated detection of model/policy/context drift.
- **Formal Methods**: TLA+ specifications of our core state machine ensure that our claims are mathematically proven, not just tested.

## 6. Ecosystem Network Effect

As more developers use `reach` to share "Proof Cards," the Requiem fingerprint becomes the "Standard of Record" for AI reliability. Companies will demand "Requiem-Verified" agents from their vendors.
