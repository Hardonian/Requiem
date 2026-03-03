# Pricing & Packaging: Requiem

## 1. OSS (Community Edition)

*Free forever. MIT Licensed.*

- **Features**: Deterministic execution, CAS with dual-hash, Local Policy Gate, Replay Verify, Reach CLI.
- **Limits**: 1,000 runs/month (suggested), 1 GB replay storage (local).
- **Target**: Individual developers, small POCs, researchers.

## 2. Pro (Cloud Tier)

*$49/mo + Usage fees.*

- **Features**: Everything in OSS + ReadyLayer Cloud Dashboard, Multi-tenant isolation, 50,000 runs/month, 50 GB replay storage (cloud).
- **Advanced Features**: Usage analytics, policy event tracking (up to 500k), team collaboration tools.
- **Target**: High-growth startups, professional AI engineers.

## 3. Enterprise (Platform Tier)

*Custom Pricing (Contact Sales).*

- **Features**: Everything in Pro + Unlimited runs/storage/policy events.
- **Exclusive Capabilities**:

  - **Cluster Coordination**: Syncing policy and CAS across global regions.
  - **Signed Artifact Chain**: End-to-end cryptographic signatures on every execution artifact.
  - **SOC 2 Compliance Controls**: Automated reporting and control mapping.
  - **Private Control Plane**: Deploy Requiem inside your VPC (AWS/GCP/Azure).
  - **SLA-backed Support**: 99.9% uptime guarantee and 4-hour response time.

- **Target**: Global 2000, government agencies, mission-critical infrastructure.

## 4. Metered Units (Concepts)

- **Run Unit**: One deterministic execution of a tool or agent step (incl. 3 retries).
- **Storage Unit**: Per-GB month for immutable replay logs and CAS volumes.
- **Policy Check**: Per-million evaluations of complex guardrail rules.

## 5. Future Roadmap Items (Labelled: Planned)

- **Model Migration Simulation as a Service**: Specialized pricing for bulk testing model upgrades.
- **Compliance Packs**: Pre-configured policy sets for HIPAA, GDPR, etc.
