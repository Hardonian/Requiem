# System Claims

This file intentionally lists only claims tied to repository verification paths.

## Claim: deterministic execution is a supported objective

- Validation path: `pnpm verify:determinism`
- Scope: repository/runtime behavior under pinned local environment and command path.
- Boundary: not a blanket claim for every external adapter/environment combination.

## Claim: replay verification path exists

- Validation path: `pnpm verify:replay`
- Scope: replay checks implemented in current scripts/CLI flow.
- Boundary: replay fidelity still depends on preserved artifacts and compatible versions.

## Claim: proof/evidence artifacts can be generated

- Validation path: `pnpm evidence`, `pnpm verify:demo`
- Scope: artifact generation and inspection in this repo.
- Boundary: trust guarantees depend on operator key management and deployment controls.

## Claim: deploy-readiness checks exist

- Validation path: `pnpm verify:deploy-readiness`, `pnpm doctor`
- Scope: static/runtime checks encoded in repository scripts.
- Boundary: these checks do not replace environment-specific threat modeling.
