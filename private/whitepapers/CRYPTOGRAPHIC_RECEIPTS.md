# Whitepaper: Cryptographic Receipts for AI

**Technical Authority Series**  
**Requiem Engineering**

## 1. Abstract

Logging is insufficient for autonomous systems. This whitepaper details the **Requiem Receipt Model**, which utilizes Merkle-signed event chains and dual-hash Content-Addressable Storage (CAS) to create immutable proofs of AI action.

## 2. The Merkle-Signed Lifecycle

Every interaction in Requiem proceeds through a three-stage commitment flow:

1. **Pre-Inference Commitment**: The prompt and policy configuration are hashed into a `PreCommit` block.
2. **In-Flight Verification**: During tool invocation, the Policy VM evaluates the request and appends a "Gate Pass" hash.
3. **Execution Finality**: The tool output and final model response are bound into a Merkle root, generating a unique `ReceiptID`.

## 3. Dual-Hash CAS (v2)

To ensure long-term auditability, artifacts are stored using two distinct primitives:
- **BLAKE3**: Used for real-time integrity checks and high-frequency deduplication.
- **SHA-256**: Used for secondary verification and compatibility with standard cryptographic toolsets.

## 4. Replay Verification Flow

The `reach verify <ReceiptID>` command performs a "Semantic Replay." It doesn't just check the log; it re-executes the tool calls in a synthetic environment. If the resulting state-hash does not match the Merkle root in the receipt, the system identifies a **Drift Event**, indicating that either the model, the tool, or the environment has tampered with the original execution.

## 5. Security Implications

This architecture prevents "Log Rewriting" attacks. An attacker who gains access to the database cannot modify historical logs without breaking the Merkle chain, providing a mathematical guarantee of audit integrity.
