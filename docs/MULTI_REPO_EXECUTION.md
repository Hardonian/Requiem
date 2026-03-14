# Multi-Repo Execution Feasibility

## Current Feasible Surface

Requiem has practical multi-repo readiness via the `rl repo` command family:

- prompt lifecycle ops (`list/run/validate/publish/graph/evolve/optimize`)
- prompt marketplace ops (`search/install/publish`)
- skills registry ops (`list/run`)
- MCP recipe execution (`repo mcp run <recipe-id>`)
- swarm/yolo/self-heal planning workflows

This is sufficient for **coordinating** work across repositories when each repo has deterministic command contracts.

## What Works Reliably Now

1. Run standardized tasks across repos using CLI command contracts.
2. Reuse prompt/skill registries as shared control-plane metadata.
3. Execute recipe-based automation with explicit steps from versioned JSON files.

## Assumptions

- Each target repo exposes deterministic commands and stable outputs.
- Authentication/authorization for external repos is handled outside local mock flows.
- Cross-repo provenance is persisted as artifacts (run IDs, trace IDs, digests).

## Limitations

- No native distributed scheduler with lease/heartbeat semantics yet.
- No built-in transactional guarantees across repo boundaries.
- Recipe execution is currently local-file centric.

## Safe Expansion Pattern

- Add remote-executor adapters behind a strict execution contract.
- Require per-repo capability declaration + trust policy allowlist.
- Store cross-repo step digests in a single provenance ledger artifact.

