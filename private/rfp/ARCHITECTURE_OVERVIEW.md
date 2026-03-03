# Architecture Overview: Requiem Enterprise

**Version**: 1.0.0  
**Last Updated**: 2026-03-02

## 1. System Topology

Requiem is comprised of four primary layers, designed for maximum isolation and auditability.

### Layer 1: The Native Engine (The "Actuator")

- **Language**: C++20.
- **Role**: Process sandboxing, tool invocation, and BLAKE3 hashing.
- **Boundary**: Strict process isolation from the host OS.

### Layer 2: The Control Plane (The "Orchestrator")

- **Language**: TypeScript (Node.js/Next.js).
- **Role**: Policy evaluation, tenant management, and API bridging.
- **Communication**: gRPC / JSON-RPC over local socket.

### Layer 3: Content-Addressable Storage (The "Memory")

- **Backend**: In-memory (Dev/Test), SQLite (Local), S3/MinIO (Cloud).
- **Integrity**: Dual-hash verification for all artifacts.

### Layer 4: ReadyLayer (The "Interface")

- **Tech Stack**: Next.js, Tailwind, Shadcn UI.
- **Role**: Visual management of the semantic ledger and policy definitions.

## 2. Integration Patterns

- **CLI-First**: All operations originate or are representable in the `reach` CLI.
- **API-Integrated**: REST/gRPC endpoints for legacy system integration.
- **MCP Native**: Supports the Model Context Protocol for seamless tool registry and tool access.

## 3. High Availability (Enterprise Only)

- **Control Plane**: Multi-node clusters with shared state via high-performance consensus (Raft).
- **CAS**: Global replication with hash-consistency checks.

## 4. Security Model

- **Deny-by-Default**: No capability is active unless a Policy VM rule explicitly enables it.
- **Domain Separation**: Secrets and tenant data are isolated at the cryptographic level using domain-specific keys.
