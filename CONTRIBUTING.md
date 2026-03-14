# Contributing to Requiem

Thanks for contributing. This project prioritizes deterministic behavior, explicit contracts, and auditable changes.

## Before you start

Read these first:

- [README.md](./README.md)
- [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md)
- [docs/OSS_BOUNDARY.md](./docs/OSS_BOUNDARY.md)
- [GOVERNANCE.md](./GOVERNANCE.md)
- [docs/DOCS_GOVERNANCE.md](./docs/DOCS_GOVERNANCE.md)

## Local setup

```bash
pnpm install --frozen-lockfile
pnpm run doctor
pnpm run build
```

`pnpm run build` compiles both engine and web surfaces. `pnpm run test` is the smoke gate; run `pnpm run verify:all` before opening a PR.

## Pull request expectations

A good PR includes:

- What changed and why.
- Scope boundaries touched (engine, CLI, ready-layer, scripts, docs).
- Commands run and results.
- Any explicit limitations you could not validate locally.

## Standards

- Keep diffs focused and minimal.
- Prefer deterministic, explicit behavior over hidden behavior.
- Reuse existing primitives before introducing new abstractions.
- Update docs/tests when behavior contracts change.

## Security and reporting

- Use [SECURITY.md](./SECURITY.md) for security disclosures.
- Use GitHub issues for reproducible bugs and scoped feature proposals.

## License

By contributing, you agree your contributions are licensed under [Apache-2.0](./LICENSE).
