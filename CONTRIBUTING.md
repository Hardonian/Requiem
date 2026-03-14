# Contributing to Requiem

Thanks for contributing. This project prioritizes deterministic behavior, clear boundaries, and auditable changes.

## Before you start

Read these first:

- [README.md](./README.md)
- [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md)
- [docs/OSS_BOUNDARY.md](./docs/OSS_BOUNDARY.md)
- [GOVERNANCE.md](./GOVERNANCE.md)
- [docs/DOCS_GOVERNANCE.md](./docs/DOCS_GOVERNANCE.md)

## Development setup

```bash
pnpm install --frozen-lockfile
pnpm build
```

For C++ test workflows, ensure CMake and a C++20-capable toolchain are available.

## Code standards

- Keep diffs focused and minimal.
- Prefer deterministic, explicit behavior over implicit or hidden behavior.
- Reuse existing primitives and patterns before introducing new abstractions.
- Update docs and tests when behavior changes.

## Commit conventions

Use clear, scoped commit messages. Preferred style:

- `docs: ...`
- `fix: ...`
- `feat: ...`
- `chore: ...`

If a change spans multiple layers, call that out clearly in the commit body.

## Pull request guidelines

A good PR should include:

- What changed and why.
- Scope boundaries affected (engine, CLI, docs, ready-layer, scripts).
- Verification commands run and results.
- Follow-up work (if any).

Do not merge TODO-only or placeholder-only PRs.

## Issue reporting

Use GitHub issues for:

- Reproducible bugs.
- Feature requests with concrete use cases.
- Documentation gaps.

For security reports, use [SECURITY.md](./SECURITY.md) instead of public issues.

## Testing expectations

Run relevant checks before opening a PR. Typical baseline:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm verify:determinism
```

If you cannot run a check locally, state the limitation explicitly in the PR.

## Documentation expectations

- Keep canonical docs concise and current.
- Archive outdated docs instead of silently deleting useful project history.
- Link new docs from existing canonical entry points.

See [docs/DOCS_GOVERNANCE.md](./docs/DOCS_GOVERNANCE.md).

## Public vs internal docs rules

- Public repo docs should contain durable developer/operator truth.
- Internal planning, scratch notes, and sensitive operational material belong outside committed public docs.
- Use ignored paths documented in `.gitignore` for non-public working material.

## License

By contributing, you agree your contributions are licensed under [Apache-2.0](./LICENSE).
