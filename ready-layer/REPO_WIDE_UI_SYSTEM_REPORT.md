# Repo-Wide UI System Report

## Visual System Issues Found & Fixed

### Design Token Drift
- **Issue**: Stitch components used hardcoded hex colors (`#1c252e`, `#2a3441`, `#137fec`, `#94a3b8`) instead of Tailwind tokens
- **Fix**: All 8 Stitch components normalized to use semantic tokens (`bg-surface`, `border-border`, `text-accent`, `text-muted`)
- **Impact**: Dark/light mode now works consistently across all Stitch components

### Inconsistent Color Systems
- **Issue**: Three parallel color systems — CSS variables, Tailwind theme tokens, and raw hex values
- **Fix**: Unified into one system: CSS variables → Tailwind tokens → component usage. Added `surface-elevated` token for layered surfaces

### Missing Dark Mode Support
- **Issue**: App sidebar hardcoded to light theme (`bg-white`, `text-slate-900`)
- **Fix**: Sidebar now uses semantic tokens, works in both light and dark modes

### Font Declaration Gap
- **Issue**: `body` used `system-ui` instead of declared `Noto Sans` font family
- **Fix**: Body now uses `font-body` (Noto Sans) as intended by the design system

## Component Duplication / Drift Findings

### Duplicated Patterns Consolidated
- `PageHeader.EmptyState` vs `StitchEmptyState` — normalized both to use same tokens
- `PageHeader.LoadingState` vs inline skeletons — canonical loading pattern established
- Stat card styling appeared in 4+ variations across pages — unified via `.stitch-stat` utility classes

### Navigation Icon Inconsistency
- **ConsoleNavigation**: Used emoji icons (🏠, 🏗️, 🔒, 💳, etc.) — replaced with Heroicons SVGs
- **App sidebar**: Had no icons — added matching Heroicons set
- Both navigations now use consistent icon sizing (w-4 h-4) and stroke styling

### Button Variant Drift
- `StitchButton` had only primary/secondary — added `ghost` variant
- Button heights normalized to `h-10` (was `h-12`, inconsistent with page buttons)
- Added `focus-visible` ring for keyboard accessibility

## Dashboard Improvements Made

### Executions Page
- Responsive grid: `grid-cols-4` → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Canonical `.stitch-stat` and `.stitch-table` classes applied
- Warning callout simplified and made accessible (`role="alert"`)
- Skeleton matches real layout structure

### Audit Ledger Page
- Consistent stat cards with token-based styling
- Export buttons use proper button styling with border radius
- Empty state messaging improved with contextual icon
- Added SEO metadata

### Policy Engine Page
- Toggle switches now have `role="switch"`, `aria-checked`, and label associations
- Enterprise controls card uses semantic dark/light contrast
- Protection layer list uses proper hover states

### Metrics Page
- Sections use `aria-labelledby` for screen reader structure
- Consistent `font-mono` for numeric values
- Responsive 3-column grid with mobile collapse

## Marketing / Product Page Improvements

### Landing Page
- Wrapped in `MarketingShell` for consistent header/footer
- Comparison table expanded (3 → 5 rows) with cleaner layout
- CTAs use consistent button sizing and spacing
- Guarantee cards use Heroicons with consistent coloring
- Trust badges use semantic `success` token

### MarketingShell
- Logo mark added (R in rounded square) for brand consistency
- Dashboard link added to header navigation
- Footer restructured with copyright, logo mark, and cleaner grid
- Sticky header with backdrop blur

### Auth Pages (signin/signup)
- Redesigned from raw text to centered card layout
- Consistent branding (logo mark, font-display headings)
- `robots: noindex` metadata added

### Privacy / Terms Pages
- Wrapped in MarketingShell for consistent chrome
- Proper metadata added

## Accessibility Fixes

### Keyboard Navigation
- Global `focus-visible` styles added to globals.css
- Skip link CSS class added for future skip-link implementation
- All clickable `StitchCard` and `StitchFeatureCard` components now handle `Enter`/`Space` keydown
- `tabIndex={0}` on interactive cards

### ARIA Improvements
- `aria-current="page"` on active nav links (both sidebars)
- `aria-label` on navigation landmarks
- `aria-hidden="true"` on decorative icons and dots
- `role="group"` with `aria-label` on nav sections
- `role="status"` on loading states with `aria-live="polite"`
- `role="alert"` on warning callouts
- `role="switch"` with `aria-checked` on toggle controls
- `aria-labelledby` on metric sections
- `aria-disabled="true"` on disabled nav items

### Reduced Motion
- `prefers-reduced-motion` media query added globally — disables all animations

### Icon Accessibility
- All emoji icons replaced with SVG icons (ConsoleNavigation, ThemeToggle)
- SVG icons have `aria-hidden="true"` when decorative
- Icon-only buttons have `aria-label`

## Metadata / SEO Fixes

### Added Metadata To
- `executions`, `audit`, `policy`, `metrics` (dashboard pages)
- `replay`, `cas`, `diagnostics`, `tenants` (dashboard pages)
- `signin`, `signup` (auth — noindex)
- `privacy`, `terms`, `runs` (marketing pages)
- Console layout (noindex for all console routes)

### Improved Root Metadata
- `themeColor` now responsive to color scheme preference
- Structured data enhanced with `url` field
- Keywords expanded

### Viewport
- `themeColor` uses media queries for light/dark

## Responsive / Mobile Fixes

### Dashboard Grids
- All stat card grids: `grid-cols-4` → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Metric grids: `grid-cols-3` → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Page headers: stack vertically on mobile with `flex-col sm:flex-row`

### Navigation
- App sidebar has `overflow-y-auto` for long nav lists
- Console sidebar already had overflow handling

### Tables
- All tables wrapped in `overflow-x-auto` containers
- Table cells use consistent padding

## Hardening Fixes

### Removed Fragile Patterns
- `animate-in slide-in-from-top-4` (non-standard) replaced with standard `animate-fade-in`
- `vertical-text` (non-standard CSS) removed from warning callout
- Hardcoded `bg-slate-*` replaced with semantic tokens throughout

### Improved State Handling
- Error boundaries use `Link` from next/link (lint compliance)
- Skeletons match real content structure in all dashboard pages
- Empty states always provide a next action or explanation

## Remaining UX Debt

1. **Mobile nav drawer**: Neither sidebar has a hamburger menu for mobile — sidebars are hidden on narrow viewports
2. **Console pages**: Individual console pages (overview, architecture, etc.) still use some inline styling that could be further normalized
3. **Intelligence pages**: Have separate styling patterns not yet fully normalized
4. **Screen component files** (`DriftScreen`, `RegistryScreen`, etc.): Not modified — may have hardcoded colors
5. **Toast system**: Radix Toast is available but no canonical toast styling established
6. **Form validation**: No canonical error message pattern for form fields
