# Stitch Integration Map

> Note: The requested `./stitch_unzipped/` directory was not present in this workspace. Integration was performed from `./stitch_system_architecture_overview/stitch_system_architecture_overview/`.

## Stitch inventory summary (Phase 0)

- Total exported screens discovered: **80**
- Dominant families:
  - Marketing/docs: `home_*`, `architecture_*`, `technical_*`, `onboarding_*`, `api_*`
  - Console/control plane: `ready_layer_control_plane_home_*`, `entitlements_*`, `observability_*`, `multi_region_replication_*`
  - Design primitives: `component_library_*`
- Variant coverage:
  - Light: present in `*_light_*` and `*_light` directories
  - Dark: present in `*_dark_*` and `*_dark` directories
  - Mixed/untyped: screens without explicit light/dark suffix

## Current app map (Next.js)

- Router: **App Router** (`ready-layer/src/app/**`)
- Existing console routes: `/console/logs`, `/console/runs`, `/console/plans`, `/console/policies`, `/console/capabilities`, `/console/finops`, `/console/snapshots`
- Existing top-level routes include: `/`, `/pricing`, `/enterprise`, `/runs`, `/runs/[runId]`, `/security`, `/support`
- Design system baseline:
  - Tailwind config at `ready-layer/tailwind.config.ts`
  - CSS variables in `ready-layer/src/app/globals.css`
  - Shared UI primitives in `ready-layer/src/components/ui/*`
- Data pattern:
  - Client-side fetch against app routes (`/api/*`) for console pages

## Stitch screen → route mapping

| Stitch Screen Family | Route | Component(s) | Data source | Status |
|---|---|---|---|---|
| `ready_layer_control_plane_home_*` | `/console/runs` | `PageHeader`, table layout | `/api/runs` | Integrated prior + retained |
| `entitlements_economic_control_*` | `/spend` | `SpendScreen` | `/api/budgets` | Integrated in this pass |
| `entitlements_api_spec_*` | `/spend/policies` | `PageHeader`, `EmptyState` | `/console/policies` link | Integrated in this pass |
| `component_library_*` | shared console UI | `PageHeader`, `LoadingState`, `EmptyState`, `ErrorDisplay` | shared components | Aligned in this pass |
| `observability_self_test_*` | `/drift` | `DriftScreen` | replay/vector diagnostics (future) | Integrated with graceful empty |
| `observability_*` detail | `/drift/[vector]` | `PageHeader`, `EmptyState` | vector diagnostics (future) | Integrated with graceful empty |
| `api_user_guide_*`, `api_implementation_guide_*` | `/registry` | `RegistryScreen` | `/api/objects` | Integrated in this pass |
| registry detail analogue | `/registry/[pkg]` | `PageHeader`, `EmptyState` | object metadata index (future) | Integrated with graceful empty |
| settings-style control panel references | `/settings` | `SettingsScreen`, `ThemeToggle` | local theme state | Integrated in this pass |

## Gaps

### Stitch screens without matching production route yet

- Marketing/doc variants from Stitch export are not yet route-for-route replaced:
  - `home_*`, `architecture_*`, `technical_*`, `onboarding_*`, `ready_layer_launch_blueprint_*`, `system_architecture_overview*`
- These remain candidates for a dedicated marketing integration pass to avoid regressions in current content and SEO.

### Existing routes without Stitch-equivalent mapping in this pass

- `/console/logs`, `/console/plans`, `/console/capabilities`, `/console/snapshots`, `/console/decisions`
- `/support`, `/security`, `/templates`, `/proof`, `/library`

These are intentionally unchanged in this pass to keep route stability and avoid regressions.
