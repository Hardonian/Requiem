# Requiem Product Context

## Canonical Product Names

- **Requiem**: The overarching platform and Provable AI Runtime.
- **Reach**: The developer toolset and CLI (`pnpm reach`).
- **ReadyLayer**: The visual management dashboard and control plane UI.

## Positioning Statement

Requiem is the only execution layer where every AI decision produces a cryptographic proof, every outcome is replayable to the byte, and every policy violation is caught before it ships. It transforms AI execution from a "black box" into a deterministic, auditable, and governed system. Requiem ensures that identically inputs always produce identical results, providing a foundational layer of trust for enterprise AI applications.

## Key Assumptions

1. **Target Persona**: Platform engineers and AI developers in regulated or high-stakes industries (FinTech, LegalTech, Healthcare) who require "Receipts" for every AI action.
2. **Current Implementation Maturity**: The core engine (C++) and control plane (TypeScript) are functional, with a focus on local and self-hosted deployments. Cloud elements like multi-tenancy and global cluster coordination are current roadmap priorities.
3. **Competitive Edge**: Unlike generic LLM routers or workflow engines, Requiem focuses on the *integrity* and *determinism* of the execution itself, using BLAKE3 hashing and Merkle-tree logging.
4. **License**: The core is OSS (MIT), with enterprise features (SLA, advanced compliance, cluster sync) planned for a "Pro" or "Enterprise" cloud offering.
