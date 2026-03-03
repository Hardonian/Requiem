# Enterprise Onboarding & Compliance Pack: Requiem

**Files Included**: DPA Structure, DPIA Template, Vendor Checklist.

---

## I. Data Processing Agreement (DPA) Structure
*Required for GDPR/CCPA compliance when using ReadyLayer Cloud.*

1. **Definitions**: Controller (Customer) vs. Processor (Requiem).
2. **Scope of Processing**: Execution metadata, audit logs, and content in CAS.
3. **Security Measures**: AES-256 encryption, TLS 1.3, BLAKE3 verification.
4. **Sub-processors**: List includes AWS/Azure for hosting.
5. **Data Transfer**: Standard Contractual Clauses (SCC) for EU-to-US transfers.

---

## II. Data Protection Impact Assessment (DPIA) Template
*Key highlights for the customer's legal team.*

- **System Description**: Provable AI Runtime for agent governance.
- **Data Minimization**: Requiem only stores what is necessary for the cryptographic receipt.
- **Risk Mitigation**: The Policy VM prevents unauthorized tool calls, reducing the risk of accidental data exposure to 3rd party model providers.
- **Impact on Individuals**: High transparency; users can see exactly why an AI decision was made via the `explain` command.

---

## III. Vendor Onboarding Checklist
*For the Procurement/IT department.*

- [ ] **Account Setup**: SSO/SAML integration verified.
- [ ] **Policy Config**: Default budgets and tool RBAC applied.
- [ ] **Reach Install**: CLI distributed to developer machines.
- [ ] **Network**: Allow-list for Requiem Control Plane IPs.
- [ ] **Audit**: Receipt storage location (Cloud vs. On-Prem) selected.
