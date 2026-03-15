# Requiem

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
![Node >=20.11](https://img.shields.io/badge/node-%3E%3D20.11.0-339933)

Requiem is an open-source deterministic execution platform for workflow and agent-style runs. It is built to make execution behavior replayable, testable, and reviewable.

This repository also contains the open-source Reach CLI and integration points for ReadyLayer Cloud.

## Project overview

This monorepo contains:

- **Requiem engine (C++ runtime):** deterministic execution core under `src/`, `include/requiem/`, and `tests/`.
- **Reach CLI (TypeScript):** operator and developer entry points under `packages/cli/`.
- **ReadyLayer web console (Next.js):** local control-plane and API surfaces under `ready-layer/`.
- **Verification and governance scripts:** root-level `scripts/` tasks used by CI and local confidence gates.

## Quickstart (canonical)

```bash
git clone https://github.com/reachhq/requiem.git
cd requiem
pnpm install --frozen-lockfile
pnpm run verify:all
```

First-clone flow and troubleshooting: [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md).

## Canonical entrypoints

- **Evaluate truth quickly:** this README + `pnpm run verify:all`
- **Operate locally:** [docs/OPERATOR_RUNBOOK.md](./docs/OPERATOR_RUNBOOK.md)
- **Contribute safely:** [CONTRIBUTING.md](./CONTRIBUTING.md)
- **Understand architecture:** [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **Inspect route maturity + dependencies:** [docs/reference/ROUTE_MATURITY.md](./docs/reference/ROUTE_MATURITY.md)

## Installation

Minimum local requirements:

- Node.js 20.11+
- pnpm 8.15+ (packageManager is pinned to `pnpm@8.15.0`)
- CMake and a C++20-capable toolchain (for engine build/test workflows)

Install dependencies:

```bash
pnpm install --frozen-lockfile
```

## Canonical root commands

- `pnpm run dev`: starts ReadyLayer local development.
- `pnpm run build`: builds engine + web surfaces from root.
- `pnpm run test`: runs engine smoke tests (`test:smoke`) for quick feedback.
- `pnpm run verify:all`: strongest repo confidence gate.
- `pnpm run doctor`: checks prerequisites and reports engine build state.


## ReadyLayer route maturity

The route surface intentionally mixes runtime-backed pages with informational and demo-safe pages.
Do not treat every console route as live backend proof.
Use [docs/reference/ROUTE_MATURITY.md](./docs/reference/ROUTE_MATURITY.md) as the source of truth for per-route expectations.

## Verification evidence map

If `pnpm run verify:all` passes, the following are directly proven in this environment:

- Route inventory and route contract checks (`routes.manifest.json` and route verification scripts).
- ReadyLayer lint/typecheck/build success.
- Requiem C++ engine build + smoke tests (`ctest` suite in `build/`).

Optional checks (run when needed) include determinism, replay, and policy-focused suites:

```bash
pnpm run verify:determinism
pnpm run verify:replay
pnpm run verify:policy
```

Run Reach CLI commands via the workspace script:

```bash
pnpm rl --help
pnpm rl doctor
```

## Repository structure

- `src/`, `include/requiem/`, `tests/`: core runtime and test coverage.
- `packages/cli/`: Reach CLI implementation.
- `ready-layer/`: ReadyLayer web/control-plane code in this monorepo.
- `docs/`: canonical and archived repository documentation.
- `scripts/`: build, verification, and governance automation.

See [docs/REPO_STRUCTURE.md](./docs/REPO_STRUCTURE.md) for a fuller map.

## Open-source vs enterprise boundary

- The open-source surface is documented in this repository and includes Requiem + Reach CLI developer workflows.
- ReadyLayer Cloud is the hosted enterprise platform and includes commercial operated services beyond the OSS local surface.

See [docs/OSS_BOUNDARY.md](./docs/OSS_BOUNDARY.md).

## Contributing

Contributions are welcome. Start with:

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [GOVERNANCE.md](./GOVERNANCE.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md)
- [docs/REPO_STRUCTURE.md](./docs/REPO_STRUCTURE.md)
- [docs/API_GOVERNANCE.md](./docs/API_GOVERNANCE.md)
- [docs/VERIFIED_CLAIMS.md](./docs/VERIFIED_CLAIMS.md)
- [docs/OPERATOR_RUNBOOK.md](./docs/OPERATOR_RUNBOOK.md)
- [docs/DOCS_GOVERNANCE.md](./docs/DOCS_GOVERNANCE.md)
- [docs/ARCHIVE_INDEX.md](./docs/ARCHIVE_INDEX.md)

This repository is licensed under [Apache-2.0](./LICENSE) unless otherwise stated.

Enterprise deployment and hosted platform boundary notes are documented in [LICENSE_ENTERPRISE_NOTE.md](./LICENSE_ENTERPRISE_NOTE.md).

## Community and support

- Security reporting: [SECURITY.md](./SECURITY.md)
- Support channels: [SUPPORT.md](./SUPPORT.md)
- Roadmap: [ROADMAP.md](./ROADMAP.md)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)
- Documentation index: [docs/README.md](./docs/README.md)
