# Product Hunt Launch Kit

## Tagline (<=60 chars)
Deterministic AI runtime with replayable proofs

## Short description
Requiem + ReadyLayer gives platform teams deterministic AI execution, content-addressed artifacts, and replay-first debugging.

## Long description
Requiem is an OSS execution kernel for AI systems that need verifiable behavior, not best-effort logs. It combines deterministic execution primitives, append-only audit trails, and CAS-backed artifacts. ReadyLayer provides the operator console for diagnostics, replay inspection, and governance checks. Reach CLI keeps local and CI verification workflows simple.

## First features to highlight
- Deterministic execution and replay workflow.
- Content-addressed artifacts with integrity verification.
- Problem+JSON API error contract and route verification checks.
- Kernel and web verification pipelines runnable in CI.
- OSS-first architecture with explicit component boundaries.

## Who it is for
- AI/platform teams running regulated or high-stakes automations.
- Developer productivity teams standardizing runtime guarantees.

## Common use cases
- Reproduce and inspect production incidents locally.
- Add policy gates and deterministic verification to agent pipelines.
- Audit artifact integrity and execution metadata in CI.

## Launch-day checklist
- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm run verify`
- [ ] `pnpm run verify:routes`
- [ ] `pnpm run verify:cpp`
- [ ] Capture/update screenshots under `launch/assets/`
- [ ] Confirm README messaging and docs index links are current

## Comment reply templates

### Support request
Thanks for trying it. If you share your OS + Node version + `pnpm run verify` output, we can help quickly.

### Bug report
Appreciate the report. Please open a GitHub issue with repro steps and logs; we prioritize deterministic/replay regressions first.

### Pricing / business model
Core runtime and tooling here are OSS. Commercial support and hosted workflows are evaluated separately from core repo scope.

### Roadmap
Near-term focus is hardening route/API guarantees, replay ergonomics, and cross-layer verification coverage.

### “How is this different?”
Main difference: we optimize for reproducibility and verifiable execution artifacts, not just orchestration convenience.
