# UI Consistency Matrix

Canonical patterns for the Requiem / ReadyLayer design system.

## Page Headers

| Property | Pattern |
|----------|---------|
| Component | `PageHeader` from `@/components/ui/PageHeader` |
| Title | `text-2xl font-bold text-foreground font-display tracking-tight` |
| Description | `text-sm text-muted mt-1.5 max-w-2xl leading-relaxed` |
| Badges | Inline after title with `gap-3` |
| Action | Right-aligned, flex-shrink-0 |
| Breadcrumbs | `text-sm text-muted` with chevron separators |
| Spacing | `mb-8` below header block |

## Cards

| Property | Pattern |
|----------|---------|
| Component | `StitchCard` from `@/components/stitch/StitchCard` |
| Surface | `bg-surface border border-border rounded-xl shadow-sm` |
| Hover | `hover:shadow-md transition-shadow duration-200` |
| Padding | sm: `p-3`, md: `p-4`, lg: `p-6` |
| Interactive | `cursor-pointer`, `tabIndex={0}`, keyboard handler |

## Stat Cards

| Property | Pattern |
|----------|---------|
| Component | `StitchStatCard` or `.stitch-stat` utility |
| Container | `bg-surface border border-border rounded-xl p-5 shadow-sm` |
| Label | `.stitch-stat-label` — `text-xs font-semibold text-muted uppercase tracking-wider` |
| Value | `.stitch-stat-value` — `text-2xl font-bold text-foreground font-display` |
| Sub-text | `.stitch-stat-sub` — `text-xs text-muted mt-2 flex items-center gap-1.5` |

## Buttons

| Variant | Pattern |
|---------|---------|
| Primary | `bg-accent text-white hover:brightness-110 rounded-lg h-10 px-5 text-sm font-semibold` |
| Secondary | `bg-surface border border-border text-foreground hover:bg-surface-elevated rounded-lg h-10 px-5` |
| Ghost | `bg-transparent text-foreground hover:bg-surface-elevated rounded-lg h-10 px-5` |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2` |
| Disabled | `disabled:opacity-50 disabled:cursor-not-allowed` |

## Tables

| Property | Pattern |
|----------|---------|
| Utility | `.stitch-table` in globals.css |
| Header | `bg-surface-elevated`, `text-xs font-semibold text-muted uppercase tracking-wider` |
| Cells | `py-3 px-4 text-foreground` |
| Rows | `border-t border-border hover:bg-surface-elevated/50 transition-colors` |
| Container | `bg-surface rounded-xl border border-border shadow-sm overflow-hidden` |
| Section header | `.stitch-section-header` — `px-5 py-3.5 border-b border-border bg-surface-elevated/50` |

## Forms

| Property | Pattern |
|----------|---------|
| Input | `bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground` |
| Label | `text-xs text-muted font-medium` |
| Toggle | `role="switch"` with `aria-checked`, `aria-labelledby`, `tabIndex={0}` |
| Toggle track | `w-8 h-4 rounded-full` — active: `bg-accent`, inactive: `bg-border` |
| Toggle thumb | `w-3 h-3 bg-white rounded-full absolute` |

## Filters / Search

| Property | Pattern |
|----------|---------|
| Container | Inline with section header or standalone bar |
| Style | Secondary button treatment or input with icon |
| Spacing | `gap-2` between filter controls |

## Empty States

| Property | Pattern |
|----------|---------|
| Component | `StitchEmptyState` or `EmptyState` from PageHeader |
| Container | `text-center py-16 px-6 bg-surface rounded-xl border border-border` |
| Icon | `h-12 w-12 text-muted` centered above text |
| Title | `text-sm font-semibold text-foreground` |
| Description | `text-sm text-muted max-w-sm mx-auto leading-relaxed` |
| Action | `mt-6` — primary or secondary button |

## Error States

| Property | Pattern |
|----------|---------|
| Component | `ErrorDisplay` from `@/components/ui/ErrorDisplay` |
| Container | `bg-destructive/5 border border-destructive/20 rounded-xl` |
| Icon | Destructive-colored warning/error icon |
| Code | `font-mono text-xs` in colored pill |
| Recovery | "Try again" + navigation buttons |
| Error ID | `text-xs font-mono text-muted/60 bg-surface-elevated rounded-lg` |

## Badges / Status

| Variant | Pattern |
|---------|---------|
| Default | `bg-accent/10 border-accent/20 text-accent` |
| Success | `bg-success/10 border-success/20 text-success` |
| Warning | `bg-warning/10 border-warning/20 text-warning` |
| Error | `bg-destructive/10 border-destructive/20 text-destructive` |
| Shape | `rounded-full px-2.5 py-0.5 border text-xs font-medium` |
| Pulse dot | `w-1.5 h-1.5 rounded-full bg-current animate-pulse` |

## Dialogs / Drawers

| Property | Pattern |
|----------|---------|
| Library | Radix UI Dialog |
| Overlay | `bg-foreground/50 backdrop-blur-sm` |
| Panel | `bg-surface border border-border rounded-xl shadow-xl` |
| Header | `px-6 py-4 border-b border-border` |
| Body | `px-6 py-4` |
| Footer | `px-6 py-4 border-t border-border flex justify-end gap-3` |

## Loading States

| Property | Pattern |
|----------|---------|
| Component | `LoadingState` from `@/components/ui/PageHeader` |
| Spinner | `animate-spin h-8 w-8 text-accent` SVG circle |
| Message | `text-sm text-muted` centered below spinner |
| Skeleton | Match real layout shape — `bg-surface-elevated animate-pulse rounded-xl` |
| ARIA | `role="status"` with `aria-live="polite"` |

## Color Tokens

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `background` | `#f8fafc` | `#0a0f16` | Page backgrounds |
| `foreground` | `#0f172a` | `#e2e8f0` | Primary text |
| `surface` | `#ffffff` | `#1c252e` | Card/panel backgrounds |
| `surface-elevated` | `#f1f5f9` | `#151e27` | Elevated surfaces, table headers |
| `border` | `#e2e8f0` | `#2a3441` | Borders, dividers |
| `muted` | `#64748b` | `#94a3b8` | Secondary text, labels |
| `accent` | `#137fec` | `#137fec` | Primary actions, active states |
| `success` | `#10b981` | `#34d399` | Success, verified, active |
| `warning` | `#eab308` | `#facc15` | Warnings, caution |
| `destructive` | `#ef4444` | `#f87171` | Errors, destructive actions |

## Typography

| Element | Classes |
|---------|---------|
| Page title | `text-2xl font-bold font-display tracking-tight` |
| Section title | `text-base font-semibold text-foreground` |
| Section label | `text-xs font-semibold text-muted uppercase tracking-widest` |
| Body | `text-sm text-foreground leading-relaxed` |
| Muted text | `text-sm text-muted` |
| Mono / code | `font-mono text-xs` |
| Stat value | `text-2xl font-bold font-display` |
