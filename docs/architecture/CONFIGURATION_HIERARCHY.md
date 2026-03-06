# Configuration Hierarchy for Review/Fix Readiness

The readiness evaluator in `ready-layer/src/lib/control-plane.ts` resolves config in this order:

1. Project overrides
2. Workspace overrides
3. Org defaults

## Evaluated dimensions
- Provider enabled
- API key present
- Review model route
- Fixer model route
- Repo binding
- Permission gates (`review:trigger`, `fixer:trigger`, `patch:apply`)

## Output contract
`computeReviewFixReadiness` returns:
- status (`Ready`, `Partial`, `Blocked`, `Misconfigured`, `Inherited`, `Disabled by policy`)
- `review_ready`
- `fixer_ready`
- reasons
- next actions

This result is intended to gate trigger buttons and fallback UX.
