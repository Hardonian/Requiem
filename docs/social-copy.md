# Social Copy

## X / Twitter

Requiem is an OSS deterministic execution runtime for workflow/agent-style operations.

If you want reproducibility instead of “it worked once,” start with:

`pnpm install --frozen-lockfile && pnpm build && pnpm verify:demo`

Replay + determinism + evidence docs are in-repo:
- docs/quickstart.md
- docs/demo-walkthrough.md
- docs/diligence.md

## LinkedIn

We just prepared Requiem for public launch.

Requiem is built for teams that need deterministic execution, replayable runs, and inspectable evidence artifacts.

Verification path:
1. `pnpm install --frozen-lockfile`
2. `pnpm build`
3. `pnpm verify:demo`
4. `pnpm verify:determinism`
5. `pnpm verify:replay`

We also published limitations and diligence docs for technical reviewers.
