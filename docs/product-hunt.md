# Product Hunt Launch Copy

## Tagline

Deterministic execution with replayable evidence for agent/workflow operations.

## Short description

Requiem helps engineering teams run deterministic execution paths and validate results with replay + evidence artifacts.

## Long description

Requiem is an OSS runtime focused on technical reviewability:

- deterministic execution checks,
- replay verification flows,
- policy-aware run paths,
- digest-addressed artifacts,
- evidence outputs you can inspect locally.

This launch is intentionally claim-bounded. We only present behaviors tied to commands and repository checks.

## Feature bullets

- Run demo in minutes (`pnpm verify:demo`)
- Validate determinism (`pnpm verify:determinism`)
- Validate replay path (`pnpm verify:replay`)
- Generate evidence bundle (`pnpm evidence`)
- Inspect limits and boundaries in repo docs

## Maker comment

If you are a skeptical engineer, that is the right stance for this project.

Please run the commands yourself and inspect generated artifacts before trusting any statement. If something is unclear or fails, file an issue with exact output so we can correct docs or behavior.

## FAQ-style launch replies

- **Does this replace every orchestration system?**
  No. It targets deterministic/replay/evidence posture.
- **Is it production-secure by default?**
  Not by assumption. Security depends on deployment controls plus verification.
- **Can I test it quickly?**
  Yes: install, build, demo, determinism, replay.

## Launch-day talking points

1. Determinism/replay/proof claims are mapped to commands.
2. Limitations are published alongside feature docs.
3. Operator checklists and external tester guide are included.

## What it is not

- Not a guarantee of universal reproducibility across every external environment.
- Not a substitute for deployment-specific threat modeling.
- Not a no-governance “prompt toy” framework.
