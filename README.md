# Requiem

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
![Node >=20.11](https://img.shields.io/badge/node-%3E%3D20.11.0-339933)

Requiem is an open-source deterministic execution platform for workflow and agent-style runs. It is built to make execution behavior replayable, testable, and reviewable.

This repository also contains the open-source Reach CLI and integration points for ReadyLayer Cloud.

## Project overview

Requiem ecosystem components:

## Quickstart (canonical)

```bash
git clone https://github.com/reachhq/requiem.git
cd requiem
pnpm install --frozen-lockfile
pnpm run verify:all
```

Then review generated artifacts under `demo_artifacts/`.

For a full onboarding path, see [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md).

## Installation

Minimum local requirements:

- Node.js 20.11+
- pnpm 8+
- CMake and a C++20-capable toolchain (for engine build/test workflows)

Install dependencies:

```bash
pnpm install --frozen-lockfile
```

## Example usage

Canonical repository verification (matches CI truth path):

```bash
pnpm run verify:all
```

Additional targeted checks:

```bash
pnpm verify:determinism
pnpm verify:replay
pnpm evidence
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

- Getting started: [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md)
- Repository structure: [docs/REPO_STRUCTURE.md](./docs/REPO_STRUCTURE.md)
- API governance: [docs/API_GOVERNANCE.md](./docs/API_GOVERNANCE.md)
- Verified claims: [docs/VERIFIED_CLAIMS.md](./docs/VERIFIED_CLAIMS.md)
- Operator runbook: [docs/OPERATOR_RUNBOOK.md](./docs/OPERATOR_RUNBOOK.md)
- Docs governance + archive: [docs/DOCS_GOVERNANCE.md](./docs/DOCS_GOVERNANCE.md), [docs/ARCHIVE_INDEX.md](./docs/ARCHIVE_INDEX.md)

This repository is licensed under [Apache-2.0](./LICENSE) unless otherwise stated.

Enterprise deployment and hosted platform boundary notes are documented in [LICENSE_ENTERPRISE_NOTE.md](./LICENSE_ENTERPRISE_NOTE.md).

## Community and support

- Security reporting: [SECURITY.md](./SECURITY.md)
- Support channels: [SUPPORT.md](./SUPPORT.md)
- Roadmap: [ROADMAP.md](./ROADMAP.md)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)
- Documentation index: [docs/README.md](./docs/README.md)
