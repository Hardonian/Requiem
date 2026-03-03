# Data Handling & Privacy Model: Requiem

**Version**: 1.0.0  
**Last Updated**: 2026-03-02

## 1. Classification of Data
Requiem handles three distinct categories of data:

| Category | Type | Storage Location | Retention |
|----------|------|------------------|-----------|
| **Metadata** | Run IDs, Timestamps, Hashes | ReadyLayer DB | Permanent (Configurable) |
| **Integrity Proofs** | Merkle Roots, BLAKE3 Digests | ReadyLayer DB | Permanent (Auditable) |
| **Execution Content** | Prompts, Tool Outputs, Logs | CAS (Cloud or Local) | User-defined |

## 2. Encryption Standards
- **In-Transit**: All data is encrypted using TLS 1.3.
- **At-Rest**: Execution content in CAS is encrypted using AES-256-GCM.
- **Keys**: Enterprise customers can utilize "Customer Managed Keys" (CMK) via AWS KMS or Azure Vault.

## 3. Data Flow & Sanitization
1. **Sanitization**: Requiem strips non-deterministic system data from every run.
2. **Identification**: Data is tagged by Tenant ID and Project ID.
3. **Hashing**: Data is hashed *before* storage. The primary index of the system is the content hash, not a user-definable string.

## 4. Multi-Tenant Isolation
- **Logical Isolation**: Databases use strict row-level security (RLS) policies.
- **Storage Isolation**: CAS buckets are domain-separated at the provider level for Enterprise tiers.
- **Verification**: Customers can run `reach tenant-check` to verify that their local engine is not communicating with unauthorized tenant volumes.

## 5. GDPR & Right to be Forgotten
Even though data is stored in an "immutable" CAS, Requiem supports **Cryptographic Shredding**. By deleting the encryption key associated with a specific tenant/project, the underlying CAS blobs become unreadable, satisfying data deletion requirements without breaking the structural integrity of the global ledger's hashes.

## 6. Access Control
Access to the Requiem Control Plane is governed by MFA-enabled SSO. Service accounts utilize short-lived JWTs for engine-to-cloud communication.
|
