# Architecture Overview

## Purpose

Requiem provides deterministic execution primitives with replay and evidence-oriented verification workflows.

## Major components

- **Core runtime (Requiem OSS)**: execution model, hashing/storage primitives, contracts, and invariants.
- **Reach CLI (OSS)**: developer interface for running workflows, checks, and evidence commands.
- **ReadyLayer code in monorepo**: web/control-plane code paths and integrations.

## Execution model (high-level)

1. CLI/tooling receives a request.
2. Runtime executes under deterministic contracts.
3. Artifacts are captured and addressed for verification/replay workflows.
4. Verification scripts validate determinism, boundaries, and route/error contracts.

## Control-plane role

ReadyLayer Cloud provides hosted control-plane operation for enterprise users.

The hosted platform should be treated as separate from local OSS runtime guarantees unless explicitly documented in public canonical docs.

## System flow summary

- **Local developer flow**: clone → install → build → run verification/demo commands.
- **Enterprise hosted flow**: managed control-plane orchestration and operational support around the same core model.

## Related docs

- [GETTING_STARTED.md](./GETTING_STARTED.md)
- [OSS_BOUNDARY.md](./OSS_BOUNDARY.md)
- [REPO_STRUCTURE.md](./REPO_STRUCTURE.md)
