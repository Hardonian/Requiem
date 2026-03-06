# Failure Intelligence (Control-Plane Core)

This architecture introduces a typed failure taxonomy and deterministic diagnosis layer in `ready-layer/src/lib/control-plane.ts`.

## Taxonomy
The module defines explicit categories for configuration, provider/model readiness, policy, replay artifacts, tool/runtime, and unknown recoverable/fatal classes.

## Diagnosis pipeline
1. Ingest raw failure message/signals.
2. Apply deterministic classifier rules (`diagnoseFailure`).
3. Emit:
   - category
   - confidence
   - likely cause
   - user-facing explanation
   - recommended actions
   - auto-remediation eligibility
   - escalation requirement

## Why this matters
- Prevents generic “execution failed” dead-ends.
- Gives operators clear remediation steps.
- Creates stable contracts for dashboard and trigger automation.
