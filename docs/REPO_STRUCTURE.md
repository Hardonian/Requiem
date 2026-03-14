# Repository Structure

This map describes where to find canonical project components and documentation.

## Core code

- `src/`, `include/requiem/`, `tests/`: core runtime and tests.
- `packages/cli/`: Reach CLI implementation.
- `packages/*`: supporting OSS packages used by CLI/web/integration flows.
- `ready-layer/`: ReadyLayer web/control-plane code in this monorepo.
- `scripts/`: automation and verification scripts.

## Documentation layout

- `docs/README.md`: canonical docs navigation spine.
- `docs/GETTING_STARTED.md`: first local setup path.
- `docs/ARCHITECTURE_OVERVIEW.md`: high-level system model.
- `docs/OSS_BOUNDARY.md`: OSS vs enterprise boundary.
- `docs/DOCS_GOVERNANCE.md`: documentation lifecycle policy.
- `docs/ARCHIVE_INDEX.md`: index of archived doc groups.
- `docs/archive/`: archived historical docs.

## Public vs private materials

- Public repository docs must be durable technical/project truth.
- Internal planning or sensitive operational notes should not be committed as public canonical docs.
- Use ignored private paths (see `.gitignore`) for local internal working material.

## Archive location convention

Use `docs/archive/<group>/...` for superseded but historically useful material.
