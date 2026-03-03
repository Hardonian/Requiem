# Security Questionnaire: Requiem Response Template

**Note**: This document contains standardized responses for Enterprise Security Reviews.

## 1. Governance & Oversight

- **Q: How are security updates managed?**
  - A: We follow a monthly patch cycle for the native engine and real-time updates for the ReadyLayer control plane.
- **Q: Is there an Incident Response Plan?**
  - A: Yes, we maintain a specific IR category for "Integrity Breaches" with automated containment protocols.

## 2. Access Control

- **Q: Does the system support SSO?**
  - A: Yes, Enterprise tier supports SAML 2.0 and OIDC.
- **Q: How is least-privilege enforced?**
  - A: Via the Policy VM, which treats all tool calls as "Deny-by-Default." Privileges must be explicitly granted per run.

## 3. Data & Cryptography

- **Q: What hashing algorithms are used?**
  - A: BLAKE3 for performance and domain-separated integrity; SHA-256 for secondary verification in the CAS.
- **Q: How are encryption keys managed?**
  - A: We use AWS KMS or customer-managed Vault instances for key rotation.

## 4. Compliance

- **Q: Are you SOC 2 compliant?**
  - A: We are currently in the audit window for SOC 2 Type II (Anticipated Q3 2026).
- **Q: Is a DPA (Data Processing Agreement) available?**
  - A: Yes, a standard DPA is included in our [Vendor Onboarding Pack](file:///c:/Users/scott/GitHub/Requiem/private/rfp/VENDOR_ONBOARDING_CHECKLIST.md).

## 5. Software Development Life Cycle (SDLC)

- **Q: Do you perform penetration testing?**
  - A: Annual third-party penetration tests are conducted. Reports are available to Enterprise customers under NDA.
- **Q: How is the supply chain secured?**
  - A: We generate CycloneDX SBOMs for every release and use `verify-supplychain.ts` for build-time verification.
