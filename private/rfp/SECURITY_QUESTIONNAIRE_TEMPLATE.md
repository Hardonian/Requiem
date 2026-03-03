# Enterprise Security Questionnaire: Requiem

**Note to Prospect**: Requiem is designed with a "Secure by Construction" philosophy. While we are currently in the process of auditing for formal certifications, our architecture is optimized for SOC 2, HIPAA, and GDPR compliance.

## 1. Governance & Access Control
- **Q: How are tool permissions managed?**
  - **A**: Requiem uses a "Deny-by-Default" Policy VM. No tool can be invoked unless explicitly granted via an RBAC policy rule. Every grant is logged with a BLAKE3 fingerprint for auditability.
- **Q: Do you support multi-tenancy?**
  - **A**: Yes. Requiem is designed to support strict tenant isolation. Each tenant has a domain-separated sandbox and storage volume.

## 2. Infrastructure & Data Security
- **Q: Where is data stored?**
  - **A**: Requiem utilizes a Content-Addressable Storage (CAS) model. Data can be stored locally (Self-hosted) or in our Cloud (ReadyLayer), which utilizes encrypted-at-rest S3-compatible backends.
- **Q: How is data integrity verified?**
  - **A**: Every artifact is dual-hashed using BLAKE3 and SHA-256. Any modification to stored data will cause the cryptographic verification (`reach verify`) to fail, alerting the system to tampering.

## 3. Compliance & Auditing
- **Q: Do you have a SOC 2 report?**
  - **A**: We are currently "Designed to support SOC 2 Compliance." Our architecture provides automated evidentiary logging for all AI transitions, significantly reducing the burden of manual audit collection.
- **Q: How are execution logs handled?**
  - **A**: Logs are stored as an immutable Merkle chain. This ensures that the sequence of AI decisions cannot be altered or deleted without breaking the chain's integrity.

## 4. Software Development Life Cycle (SDLC)
- **Q: How do you handle vulnerabilities?**
  - **A**: We utilize automated dependency scanning, linting, and a rigorous "Green Metric" CI/CD pipeline. Our core engine is formally specified using TLA+ to prevent logical race conditions.

## 5. Privacy
- **Q: Does Requiem see my LLM data?**
  - **A**: In self-hosted mode, Requiem operates entirely within your perimeter. In Cloud mode, we only process metadata required for the Semantic Ledger, unless Full Trace logging is explicitly enabled by the customer.
