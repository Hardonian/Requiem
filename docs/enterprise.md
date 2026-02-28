# Enterprise Features

ReadyLayer Enterprise provides governance controls for AI delivery teams.

## Feature Gates

Enterprise features are gated at both compile-time and runtime. The open-source
core functions independently — enterprise modules add governance, compliance,
and multi-tenant controls on top.

### OSS (Open Source)

- Deterministic execution engine
- Content-addressable storage (CAS)
- Replay verification
- Policy engine (basic rules)
- CLI tool execution and audit
- Single-tenant operation

### Enterprise (Gated)

- Multi-tenant isolation with RBAC
- SOC 2 compliance controls
- Advanced policy engine (DGL, CPX, SCCL)
- Signed artifact chain and evidence exports
- Cluster coordination and drift detection
- Cost accounting and chargeback
- Adversarial safety monitoring
- SLA-backed support

## Architecture Boundary

Enterprise code lives behind explicit feature gates:

- **Runtime**: Checked via `REQUIEM_ENTERPRISE=true` environment variable
- **Build-time**: Enterprise modules are in separate packages/directories
- **Import boundary**: Verified by `scripts/verify-boundaries.sh` in CI

The OSS build never imports enterprise-only modules. This is enforced by CI.

## Deployment Options

| Mode | Description |
|------|-------------|
| Cloud-managed | Hosted at readylayer.com |
| On-premises | Self-hosted with license key |
| Hybrid | Cloud control plane, on-prem execution |

## Contact

For enterprise inquiries: sales@readylayer.com
