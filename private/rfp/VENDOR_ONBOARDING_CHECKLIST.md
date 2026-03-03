# Vendor Onboarding & Compliance Pack: Requiem

**Version**: 1.0.0  
**Last Updated**: 2026-03-02

## 1. Required Legal Documents

- [ ] **Master Service Agreement (MSA)**: Governing the relationship and IP ownership.
- [ ] **Data Processing Agreement (DPA)**: Outlining GDPR and SOC 2 compliance requirements.
- [ ] **Security Addendum**: Detailed requirements for key management and isolation.

## 2. Onboarding Workflow

1. **Environmental Audit**: Run `reach doctor` on the customer's VPC.
2. **Policy Baseline**: Define the "Deny-by-Default" rule set for the initial 3 tools.
3. **Identity Sync**: Connect ReadyLayer to the customer's SSO (Okta/Azure).
4. **CAS Provisioning**: Setup the dedicated S3 buckets for artifact storage.

## 3. Data Protection Impact Assessment (DPIA) Template

Requiem simplifies DPIA by providing an automated **Traceability Matrix**:

- **Source**: Where did the AI prompt originate?
- **Transformation**: How was it governed by the Policy VM?
- **Persistence**: Where is the signed receipt stored?

## 4. Vendor Risk Assessment

- **Availability**: Multi-region failover configuration for ReadyLayer nodes.
- **Portability**: All Merkle receipts are exportable in standard JSON/CBOR formats to prevent lock-in.
- **Financial**: Requiem maintains a "Business Continuity Insurance" policy for Enterprise customers.
