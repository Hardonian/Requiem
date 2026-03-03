# Vendor One-Pager: Requiem / Zeo

## 🏢 Company: Zeo

**Product**: Requiem
**Description**: Provable AI Runtime. The only execution layer that produces cryptographic proofs for every AI decision.

## Support & Service Level Agreements (SLA)

| Support Tier | Service Level Goal | Target Availability |
| :--- | :--- | :--- |
| **Enterprise** | 4h initial response (P0/P1) | 99.9% Control Plane Uptime |
| **Business** | 8h initial response (P0/P1) | 99.5% Control Plane Uptime |
| **OSS/Community** | Best effort | N/A (Self-hosted) |

## Data & Security

- **Isolation**: Tenant data is isolated at the `result_digest` level. No cross-tenant leakage.
- **Verification**: Built-in Microfracture Suite for automated compliance-ratchet checks.
- **Auditability**: Every run produces a 64-character BLAKE3 fingerprint. Replayable to the byte.
- **Infrastructure**: Support for AWS (S3/Dual-hash), GCP, and On-Premise deployments.

## Compliance Foundation

**Designed to Support**:
- SOC 2 Type II
- GDPR (Data Residency and Right to be Forgotten)
- HIPAA (Business Associate Agreement available for Enterprise)
- FedRAMP (High) readiness

*Note: All compliance claims are subject to the active implementation of the Security Boundaries documented in `/docs/`. Internal audits and external certifications are [Placeholder - REPLACE WITH CURRENT STATUS].*
