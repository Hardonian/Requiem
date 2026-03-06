# Differentiator Fit Matrix

## Current capability map (ground truth)

| Surface | Current state | Notes |
|---|---|---|
| Data model | **Partial** | Run, replay, policies, intelligence, and foundry entities exist in route/domain types, but control-plane specific entities (triggers/readiness snapshots/diagnoses) were not consolidated under one typed module. |
| Event model | **Partial** | Structured events and audit logs exist; control-plane trigger/audit events are not yet centrally normalized. |
| API routes | **Strong baseline** | Problem+JSON and tenant-aware wrappers already exist on major routes (`withTenantContext`). |
| Dashboard pages | **Partial** | Many operational pages exist (`/app/*`, `/console/*`) but a single action-centric control-plane intelligence contract was missing. |
| Replay/determinism | **Present** | Replay verification route and related pages exist. |
| Policy/governance | **Present** | Policy pages and API routes exist, simulation UX still fragmented. |
| Provider/model configuration | **Partial** | Config/settings pages exist but hierarchical readiness and fallback reasoning were not unified in one typed evaluator. |
| Review/fix orchestration | **Partial** | Core routes exist; explicit readiness contract for review/fixer action gating was not exposed as a reusable module/API. |
| Failure intelligence | **Partial** | Error handling exists, but typed taxonomy + diagnosis + actionable insight generation were not integrated. |

## Differentiator fit (requested capability vs implementation status)

| Capability | Fit status | Gap before this pass | Change in this pass |
|---|---|---|---|
| Trust graph / proof explorer | Partial | Existing run/proof routes lacked a consolidated control-plane contract. | No UI expansion in this patch; documented and prepared with typed diagnosis/readiness inputs that can feed proof surfaces. |
| Deterministic replay lab | Partial | Replay exists, limited cross-surface risk/intelligence linkage. | Added typed failure category `REPLAY_ARTIFACT_MISSING` and insight hooks for replay guardrails. |
| Failure intelligence layer | **Now stronger** | No centralized typed taxonomy and diagnosis function. | Added taxonomy, diagnosis engine, and actionable insight generation module/API. |
| Policy simulator / governance sandbox | Partial | Existing policy surfaces lacked direct insight-action coupling. | Added insight contract fields (manual/auto trigger availability + blocked reason) for governance actioning. |
| BYO adapter layer | Partial | Adapter shape exists in broader repo, not wired to control-plane readiness contract. | No adapter code changes in this patch. |
| Eval foundry / benchmark harness | Present | Existing foundry routes are separate from operations insights. | No direct changes in this patch. |
| Actionable dashboard with AI insights | **Now stronger** | Insights were distributed and not normalized into an action contract. | Added explicit insight schema with recommended action/deep links/triggerability semantics. |
| Manual + auto triggers | Partial | Triggerability status not consistently represented. | Insight payload now explicitly encodes manual/auto trigger availability and block reasons. |
| Review/fixer trigger system | **Now stronger** | No shared readiness engine for hierarchical config inheritance and fallback decisions. | Added review/fixer readiness computation with inheritance + fallback semantics. |
| Missing-config/provider fallback | **Now stronger** | Missing key/provider/model states were handled ad hoc. | Added typed readiness reasons/next actions and taxonomy-based diagnosis for common failure classes. |

## Canonical terms adopted in new control-plane contracts

- **Run**: execution instance
- **Replay**: re-execution attempt from historical run inputs/artifacts
- **Proof**: evidence metadata attached to execution (current patch references but does not extend proof storage)
- **Policy**: allow/deny/governance controls
- **Insight**: computed actionable finding backed by observed evidence
- **Recommendation**: next best action for operator
- **Trigger**: manual or automated action execution request
- **Auto-fix**: policy-gated remediation that can apply changes when safe
- **Review**: model/manual verification workflow
- **Remediation**: corrective action after diagnosis
- **Adapter**: ingestion mapping layer for external workflows
- **Org/Workspace/Project**: hierarchical configuration scopes
