# Whitepaper: Cryptographic Receipts for AI

**Technical Authority Series**  
**Requiem Engineering**

## 1. Introduction: From Logs to Evidence
Traditional logging systems (Syslog, LangSmith) are "untrusted." A system administrator or a savvy attacker can modify logs after the fact to hide malicious behavior. A **Cryptographic Receipt** is a tamper-evident claim of state that can be independently verified.

## 2. The Merkle-Signed Lifecycle
Requiem's receipt generation follows a Merkle-tree execution graph:
1. **Leaf Nodes**: Individual tool calls and model responses, each hashed with BLAKE3.
2. **Intermediate Nodes**: Semantic transitions (e.g., "Decision made to buy stock").
3. **Root Fingerprint**: The final execution hash, signed by the Requiem private key and the Tenant's public key (Enterprise tier).

## 3. Dual-Hash CAS (Content-Addressable Storage)
To prevent "collision attacks" and ensure long-term shelf-life, Requiem receipts reference data in a dual-hash CAS:
- **BLAKE3**: Used for high-speed local verification and execution.
- **SHA-256**: Used for archival integrity and cross-system compatibility.
Divergence between these two hashes triggers a "Tamper Alert."

## 4. Replay Verification Flow
A receipt is meaningless if it cannot be challenged. Requiem allows any auditor to perform a **Challenge-Response Replay**:
1. Request the receipt for Run $X$.
2. Requiem spins up a fresh sandbox using the *exact same* determinants listed in the receipt.
3. The engine re-executes the logic (mocking external tool calls with the original CAS data).
4. If it matches, the receipt is "Verified."

## 5. Security Implications
Receipts provide **Non-Repudiation**. If an AI agent performs an action on behalf of a user, the organization can prove to a court or regulator exactly what the AI was "thinking" and what instructions it followed, with bit-perfect evidence.
