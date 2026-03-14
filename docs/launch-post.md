# Launch Post (GitHub / Blog Draft)

## Requiem is now publicly launch-ready (with bounded caveats)

We are launching Requiem as an OSS deterministic execution runtime with replay and evidence surfaces.

What you can verify immediately:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm verify:demo
pnpm verify:determinism
pnpm verify:replay
pnpm evidence
```

This release emphasizes operational truth over hype:

- claims are tied to scripts and artifacts,
- limitations are documented,
- launch docs include troubleshooting and operator checklists.

Start here:

- `docs/quickstart.md`
- `docs/demo-walkthrough.md`
- `docs/diligence.md`
- `docs/limitations.md`
