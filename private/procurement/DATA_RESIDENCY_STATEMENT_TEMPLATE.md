# Data Residency Statement (Template)

## 📍 Data Hosting Location: Requiem / Zeo

**Environment**: [AWS / GCP / Azure / On-Premise]
**Region**: [e.g., us-east-1]
**Sub-Processor**: [e.g., Amazon Web Services, Inc.]

## In-Transit Protection

- **Protocol**: TLS 1.3 for all control plane communications.
- **Verification**: Mutual TLS (mTLS) for all runtime-to-engine connections.

## At-Rest Protection

- **Hashing**: All data is stored in the Content-Addressable Storage (CAS) v2.
- **Verification**: BLAKE3 domain-separated hashing.
- **Encryption**: AES-256 for all stored artifacts, with customer-managed keys (CMK) available for Enterprise.

## Data Life Cycle

| Data Type | Description | Retention (Default) |
| :--- | :--- | :--- |
| **Execution Fingerprint** | 64-character BLAKE3 hash. | Indefinite (Immutable Ledger) |
| **Execution Payload** | Input JSON and resulting output. | 30 days (Configurable) |
| **Policy Events** | Governance gate successes/failures. | 90 days (Configurable) |
| **Audit Logs** | Control plane access logs. | 365 days (Enterprise) |

## Compliance & Right to be Forgotten

Requiem supports the `nuke` command (`pnpm reach nuke <artifact_id>`) to permanently scrub specific execution payloads while maintaining the global ledger integrity for auditing.
