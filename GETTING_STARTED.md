# Getting Started (Canonical Entry)

Use this sequence for first-clone confidence:

1. `pnpm install --frozen-lockfile`
2. `pnpm run doctor`
3. `pnpm run verify:all`
4. `pnpm run dev`

## Root command contract

- `pnpm run dev`: starts the ReadyLayer local dev server (primary day-to-day entry point).
- `pnpm run build`: builds both the Requiem engine (`build:engine`) and web surfaces (`build:web`).
- `pnpm run test`: runs the engine smoke test suite (`test:smoke`) for quick local feedback.
- `pnpm run verify:all`: strongest canonical root verification gate.
- `pnpm run doctor`: checks blocking local prerequisites and reports engine build state.
