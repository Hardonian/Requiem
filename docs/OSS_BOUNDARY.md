# Open-Source and Enterprise Boundary

This document defines the practical boundary between what is available in this repository and what is provided as a hosted enterprise service.

## Open-source surface (this repository)

The open-source surface includes:

- Requiem core runtime code and contracts.
- Reach CLI source, scripts, and local verification workflows.
- Public documentation needed to install, run, verify, and contribute.
- Local development flows that run on a developer machine.

## ReadyLayer Cloud (enterprise surface)

ReadyLayer Cloud is the hosted/commercial control-plane offering.

This repository may include integration code and interfaces for ReadyLayer, but enterprise hosted operation itself is distinct from local OSS use.

## What developers can run locally

Developers can run:

- Build and verification commands from this repository.
- Reach CLI local commands and demo workflows.
- Local deterministic/replay/evidence checks as implemented in OSS scripts and packages.

## What enterprise customers receive

Enterprise customers receive hosted control-plane operation and commercial support paths. The exact enterprise feature set is contract-specific and should not be inferred from repository placeholders or internal planning notes.

## Boundary rules used in this repository

- OSS code paths must not rely on private enterprise-only source imports.
- Public docs must avoid presenting private planning or speculative enterprise claims as current product truth.
- Any enterprise references in OSS docs should be explicit about hosted/commercial context.

For contribution and governance policy, see:

- [../CONTRIBUTING.md](../CONTRIBUTING.md)
- [../GOVERNANCE.md](../GOVERNANCE.md)
- [DOCS_GOVERNANCE.md](./DOCS_GOVERNANCE.md)
