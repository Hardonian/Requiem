# Architecture Overview

This document summarizes the core Requiem/ReadyLayer data path for deterministic execution, evidence generation, and replay.

## Component Diagram

```mermaid
flowchart LR
    CLI[CLI\n(reach/requiem)] --> EE[Execution Engine]
    WEB[Web Console\n(ReadyLayer)] --> EE

    EE --> PE[Policy Engine]
    EE --> CAS[CAS Storage]
    EE --> PR[Proof Engine]
    EE --> RP[Replay System]

    PE --> PR
    CAS --> PR
    CAS --> RP
    PR --> WEB
    RP --> CLI
```

## Components

### CLI
Operator entrypoint for run/verify/replay/diagnostic commands. The CLI drives execution and verification workflows used in local development and CI.

### Execution Engine
Deterministic runtime core that canonicalizes inputs, executes workflow steps, and emits structured run artifacts.

### Policy Engine
Evaluates policy-as-code decisions for tool/workflow actions. Decisions and policy digests are attached to execution evidence.

### CAS Storage
Content-addressed storage for run artifacts and referenced blobs. Integrity checks depend on digest-addressed reads/writes.

### Proof Engine
Builds execution receipts/proofpacks from run data, policy material, and CAS references. Used for auditability and downstream verification.

### Replay System
Reconstructs and re-evaluates prior executions from stored artifacts to validate reproducibility and detect drift.

### Web Console
Operational surface for inspection, diagnostics, and replay/proof visibility. It consumes execution and verification data produced by backend components.

## Data Flow (Condensed)

1. CLI or Web Console submits execution request.
2. Execution Engine canonicalizes input and requests policy decisions.
3. Policy Engine returns allow/deny decisions with policy context.
4. Execution artifacts are persisted to CAS using content digests.
5. Proof Engine derives verification artifacts (receipts/proofpacks).
6. Replay System replays stored runs from CAS artifacts.
7. CLI/Web surfaces verification and replay outcomes to operators.
