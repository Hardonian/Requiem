# PROOF DEPENDENCY MODEL

Proposal generation is now runtime-enforced through `enforceProofDependencies()`.

Default secure requirements:

- `determinism`
- `integrity`
- `trust`
- `economics`
- `simulation` (only when `REQUIEM_SIMULATION_ENABLED=true`)

Configuration:

- Optional override: `REQUIEM_REQUIRED_PROOFS=determinism,integrity,trust,economics[,simulation]`
- Config is loaded once and frozen per process.

Enforced entry points:

- `generatePatch()`
- `runLearningPipeline()` (when patch generation is enabled)

Failure behavior:

- Throws structured 409 Problem+JSON (`code=proof_dependencies_missing`)
- Includes deterministic `reasons[]` and `errors[]`

Example payload:

```json
{
  "type": "https://httpstatuses.com/409",
  "title": "Proof dependencies missing",
  "status": 409,
  "detail": "Required proof packs are not available",
  "trace_id": "trace-1",
  "code": "proof_dependencies_missing",
  "reasons": ["determinism"],
  "errors": [{ "proof": "determinism", "reason": "missing" }]
}
```
