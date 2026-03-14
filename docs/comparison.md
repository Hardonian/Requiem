# Comparison: Requiem vs Existing Systems

This table focuses on technical properties, not category positioning.

| System | Primary Abstraction | Deterministic Replay (workflow/result oriented) | Proof Artifacts | Policy-as-Code Evaluation Evidence | Content-Addressed Storage as Core Primitive | Cryptographic Traceability Surface |
|---|---|---|---|---|---|---|
| **Requiem** | Deterministic agent/workflow runtime | **Yes** (explicit replay workflows and replay verification surfaces) | **Yes** (proofpack/receipt-oriented artifacts) | **Yes** (policy gates tied to execution artifacts) | **Yes** (CAS/integrity workflows are first-class) | **Yes** (digest-linked artifacts; signing/integrity surfaces where configured) |
| LangChain | LLM application/orchestration library | Partial (depends on app design and external logging) | Partial (via integrations, not a single default artifact model) | Partial (external policy stacks) | No (not a core default) | Partial (integration-dependent) |
| Temporal | Durable workflow orchestration | Strong workflow event replay, not agent-proofpack focused | Partial (workflow history, not proofpack schema by default) | Partial (policy generally external) | No (not CAS-first) | Partial (depends on deployment controls) |
| Airflow | Batch DAG orchestration | Limited for deterministic agent-style state replay | No default proof artifact model | Partial (policy mostly infra/platform side) | No | Limited |
| Ray | Distributed compute/runtime | Limited (focus is distributed execution, not reproducible proof receipts) | No default proofpack model | Partial | No | Limited |
| Dagster | Data orchestration/asset pipelines | Partial (re-execution lineage exists; deterministic agent replay is not primary) | Partial (metadata/events) | Partial | No | Limited |
| CrewAI | Multi-agent orchestration framework | Partial/experimental depending on implementation | Limited | Partial | No | Limited |
| AutoGen | Agent conversation/orchestration framework | Partial/experimental depending on implementation | Limited | Partial | No | Limited |

## Notes on Interpretation

- "Partial" means the capability is possible with composition/integration but not usually a default, end-to-end, verifiable path.
- Requiem-specific claims above should be validated against local commands and docs before external publication in your environment.
- This comparison intentionally avoids performance and scale claims unless benchmark evidence is attached.
