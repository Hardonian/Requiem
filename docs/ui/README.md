# UI Integration Guide (Stitch + Requiem)

## Where Stitch assets live

- Current imported export path: `stitch_system_architecture_overview/stitch_system_architecture_overview/`
- Integration planning document: `docs/ui/STITCH_INTEGRATION_MAP.md`

## Token system and dark mode

- Theme tokens are defined as CSS variables in `ready-layer/src/app/globals.css`.
- Tailwind maps these tokens in `ready-layer/tailwind.config.ts` (`background`, `surface`, `foreground`, `border`, `muted`, `accent`, etc.).
- Dark mode is class-driven (`darkMode: 'class'`) via `next-themes` and a single `<ThemeProvider>` in root layout.
- Use one component per route; do **not** fork separate light/dark pages.

## Component conventions

- Route-level screen components live in `ready-layer/src/components/screens/<screen>/`.
- Reusable primitives remain in `ready-layer/src/components/ui/`.
- Every new route should include:
  - metadata title/description
  - loading state
  - empty state
  - error state with code/trace where available

## Adding a new Stitch screen

1. Add or update route file under `ready-layer/src/app/.../page.tsx`.
2. Build a screen component under `ready-layer/src/components/screens/...`.
3. Reuse `PageHeader`, `LoadingState`, `EmptyState`, `ErrorDisplay`.
4. Wire to existing `/api/*` endpoints before adding any new endpoint.
5. Update `docs/ui/STITCH_INTEGRATION_MAP.md`.
