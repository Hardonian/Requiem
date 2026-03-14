# Requiem (OSS runtime) + ReadyLayer (operator console)

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
![Node >=20.11](https://img.shields.io/badge/node-%3E%3D20.11.0-339933)
![Deterministic replay](https://img.shields.io/badge/runtime-deterministic%20replay-black)

Requiem is a deterministic execution runtime for workflow/agent-style operations with replay and evidence artifacts.

It matters when logs are not enough: you need repeatable runs, explicit policy gates, and machine-checkable artifacts for review.

## Core primitives

- **Deterministic execution contract** with versioned behavior and replay checks.
- **CAS-backed artifacts** addressed by digest for integrity validation.
- **Policy gates** evaluated during execution, not only in post-hoc analysis.
- **Proof/evidence surfaces** (`proofpack`, receipts, benchmark artifacts) for audit and incident review.

## Quickstart (first successful run)

```bash
git clone https://github.com/reachhq/requiem.git
cd requiem
pnpm install --frozen-lockfile
pnpm build
pnpm verify:demo
```

Then open:

- `demo_artifacts/demo-summary.json`
- `demo_artifacts/demo-receipt.json`

## Demo + replay + proof checks

```bash
# Environment and repo doctor checks
pnpm doctor

# Run demo flow and generate artifacts
pnpm verify:demo

# Determinism/proof/replay checks used in diligence
pnpm verify:determinism
pnpm verify:replay
pnpm evidence
```

## Proof and verification surfaces

- Proofpack and evidence model: [docs/proofpacks.md](./docs/proofpacks.md)
- System claims and testable boundaries: [docs/system-claims.md](./docs/system-claims.md)
- Explicit limitations and non-goals: [docs/limitations.md](./docs/limitations.md)

## Architecture and deeper docs

- Architecture overview: [docs/architecture-overview.md](./docs/architecture-overview.md)
- Quickstart (canonical path): [docs/quickstart.md](./docs/quickstart.md)
- First 10 minutes guide: [docs/first-10-minutes.md](./docs/first-10-minutes.md)
- Demo pack: [docs/demo-walkthrough.md](./docs/demo-walkthrough.md)
- Technical diligence pack: [docs/diligence.md](./docs/diligence.md)
- Comparison + positioning: [docs/comparison.md](./docs/comparison.md), [docs/positioning.md](./docs/positioning.md)

## Launch status

Current launch verdict is documented in `docs/release-checklist.md` and `docs/launch-checklist.md`.

## Trust and contribution surfaces

- Security policy: [SECURITY.md](./SECURITY.md)
- Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)
