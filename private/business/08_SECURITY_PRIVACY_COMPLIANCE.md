# Security, Privacy & Compliance: Requiem

## 1. Data Handling Model
Requiem is designed with a **Privacy-First** posture:
- **Zero-Persistence by Default**: Local runs do not send data to any cloud unless explicitly connected to a ReadyLayer instance.
- **Content-Addressable Storage (CAS)**: Data is stored based on its hash. This allows for deduplication and efficient audit trails without storing redundant PII.
- **Tenant Isolation**: (Enterprise) Logical and physical separation of tenant data in the control plane.

## 2. Threat Model Overview
- **Unauthorized Tool Execution**: Mitigated by the native Policy Gate (deny-by-default).
- **History Tampering**: Mitigated by Merkle-chain hashing of all run logs.
- **Provider Impersonation**: (Roadmap) Signed results from models verified against known provider keys.
- **Drift Attack**: Detected via the Semantic State Machine's drift taxonomy.

## 3. Compliance Support
Requiem is built to *support* the following frameworks (Note: Requiem platform itself is currently in progress towards certification):
- **SOC 2 Type II**: Supports controls for Security, Availability, and Confidentiality.
- **GDPR**: Facilitates "Right to Explanation" via the `reach explain` command and audit trails.
- **HIPAA**: Policy gates can be configured to prevent the transit of PHI (Protected Health Information) to unapproved models or tools.

## 4. Auditability Claims
- **Tamper-Evidence**: Every record in the Requiem ledger is cryptographically linked.
- **Replay-Verification**: Third parties can re-execute code against the same hashes to verify claims.
- **Policy Transparency**: All active policies are auditable via `reach policy explain`.

## 5. Supply-Chain Posture
- **SBOM**: Requiem generates a CycloneDX SBOM for every release.
- **Dependency Pinning**: All dependencies are pinned and verified.
- **Audit Logs**: Internal development process is strictly governed, with no secret leakage in public repositories.
