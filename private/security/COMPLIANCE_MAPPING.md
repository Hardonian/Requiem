# Compliance Mapping: Requiem to Standard Frameworks

**Version**: 1.0.0  
**Last Updated**: 2026-03-02

## 1. SOC 2 Type II Alignment

| Trust Service Criteria | Requiem Control | Evidence Artifact |
| :--- | :--- | :--- |
| **Common Criteria 6.1** (Access Control) | Policy VM Deny-by-Default enforcement. | Policy Event Logs (Signed) |
| **Common Criteria 7.1** (System Operations) | `reach doctor` and `verify-system` diagnostic suites. | CI Run Reports |
| **Common Criteria 8.1** (Change Management) | BLAKE3 Commitment to policy state. | Merkle Root in the Ledger |

## 2. EU AI Act Alignment

| Requirement | Requiem Feature | Evidence Artifact |
| :--- | :--- | :--- |
| **Auditability** | Cryptographic Receipts for every AI action. | `.receipt` JSON Files |
| **Traceability** | Merkle-chain lineage of all model tool calls. | `reach lineage` Output |
| **Human Oversight** | Policy VM overrides and threshold alerts in ReadyLayer. | Alert History Dashboard |

## 3. GDPR Alignment

| Article | Requiem Implementation |
| :--- | :--- |
| **Article 25** (Privacy by Design) | Domain-separated hashing and zero-knowledge policy evaluations. |
| **Article 30** (Records of Processing) | The Semantic Ledger is a continuous record of all AI data processing steps. |
| **Article 32** (Security of Processing) | Native sandboxing and process-level isolation. |

## 4. FedRAMP (High) Preliminary Mapping

- **AC-4**: Information Flow Enforcement (Handled by Policy VM).
- **AU-10**: Non-repudiation (Handled by BLAKE3 signed receipts).
- **SC-39**: Process Isolation (Handled by Native Engine).
