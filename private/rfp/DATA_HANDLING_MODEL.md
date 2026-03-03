# Data Handling & Privacy Model: Requiem

**Version**: 1.0.0  
**Last Updated**: 2026-03-02

## 1. Data Classification

Requiem classifies data into three categories to ensure appropriate protection:

- **System Metadata**: Hashes, run IDs, policy rules (Public/Internal).
- **Execution Artifacts**: Prompts, tool outputs, logs (Sensitive/Private).
- **Secrets**: API keys, DB credentials (Highly Confidential).

## 2. Encryption Standards

- **At-Rest**: AES-256-GCM for all disk-based storage in the CAS.
- **In-Transit**: TLS 1.3 for all API and dashboard communication.
- **Secrets**: Never stored in the CAS; managed via external Vault or Environment Variable injection at the Policy VM gate.

## 3. Data Flow & Sovereignty

- **Local-Only Option**: For high-security environments, Requiem operates entirely within the customer VPC. No data leaves the perimeter.
- **Redaction**: Requiem can automatically redact PII (Personally Identifiable Information) from logs before they are committed to the long-term ledger.

## 4. Multi-Tenancy

- **Cryptographic Isolation**: Each tenant has a unique BLAKE3 domain key.
- **Physical Isolation**: Optional dedicated CAS volumes for Enterprise customers.

## 5. Compliance & GDPR

| Requirement | Mitigation |
| :--- | :--- |
| **Right to Erasure** | Deterministic deletion of tenant-specific CAS blobs. |
| **Data Portability** | Standard JSON export of Merkle receipts. |
| **Audit Log** | The Requiem Semantic Ledger is an immutable audit log by design. |
| **Data Protection Impact Assessment (DPIA)** | Provided as part of the Enterprise Compliance Pack. |
