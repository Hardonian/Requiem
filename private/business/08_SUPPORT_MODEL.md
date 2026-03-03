# Support & Operations Model: Requiem

**Version**: 1.0.0  
**Last Updated**: 2026-03-02

## 1. Support Tiers

### Community Support (OSS)
- **Channels**: GitHub Issues, Discord Community.
- **SLA**: Best effort.
- **Focus**: Bug reports, feature requests, "How-to" guidance.

### Professional Support (Pro)
- **Channels**: Email desk, Dedicated Discord Channel.
- **SLA**: 24-hour response (Business Days).
- **Focus**: Integration help, performance tuning, policy modeling.

### Enterprise Support (SLA-Backed)
- **Channels**: Phone, Slack Connect, PagerDuty (for P0).
- **SLA**: 1h for P0 (System Down), 4h for P1 (Major Degredation).
- **Focus**: Cluster reliability, security incidents, compliance auditing.

## 2. Shared Responsibility Model

| Layer | Requiem Responsibility | Customer Responsibility |
|-------|-------------------------|-------------------------|
| **Model** | None | Model selection, prompting logic. |
| **Runtime** | Engine integrity, hashing logic. | Updates, local environment security. |
| **Policy** | VM execution, logic enforcement. | Writing and auditing the policy rules. |
| **Storage** | CAS integrity, Merkle signing. | Backup of local volumes / S3 keys. |

## 3. Incident Response (IR) for AI
Requiem introduces a new IR category: **Integrity Breach**.
- **Definition**: When a replayed run fails verification against its fingerprint.
- **Response**: Immediate suspension of the affected tenant's execution until the drift source (corruption, tamper, or environment change) is identified.

## 4. Operational Health Metrics
- **Verification Pass Rate**: % of runs that successfully verify (target > 99.99%).
- **Policy Latency (P99)**: Time spent in the Policy VM gate.
- **CAS Health**: Blob-to-Hash alignment across replicated nodes.

## 5. Escalation Path
1. **L1 (Community/Onboarding)**: Success Engineer (Technical).
2. **L2 (Integration/Bugs)**: Core Engineering Team.
3. **L3 (Security/Platform)**: CTO / Security Lead.
|
