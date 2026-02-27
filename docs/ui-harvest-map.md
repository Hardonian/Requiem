# UI Harvest Map

**Generated:** 2026-02-27  
**Mission:** Consolidate BEST UX/UI from Reach + ReadyLayer into Requiem UI Kit  
**Status:** Phase 1 Complete - Core primitives and patterns extracted

---

## Source Inventory

### ReadyLayer (Primary Source)
- **Framework:** Next.js 16 + React 19
- **Styling:** Tailwind CSS 3.4 + CSS Variables
- **Primitives:** Radix UI + class-variance-authority
- **Animation:** Framer Motion
- **Charts:** Recharts

### Reach/apps/arcade (Secondary Source)
- **Framework:** Next.js + React
- **Domain:** Operational dashboards, execution timelines, governance UI
- **Value:** Complex data visualization patterns, admin interfaces

---

## Component Inventory

### Tier 1: Foundational Primitives

| Component | Origin | New Location | Dependencies | OSS Safe | Notes |
|-----------|--------|--------------|--------------|----------|-------|
| Button | ReadyLayer/components/ui/button.tsx | /packages/ui/src/components/primitives/button.tsx | @radix-ui/react-slot, cva | ✅ | Radix Slot for composition |
| Card | ReadyLayer/components/ui/card.tsx | /packages/ui/src/components/primitives/card.tsx | cva | ✅ | Elevation variants (flat/raised/overlay) |
| Badge | ReadyLayer/components/ui/badge.tsx | /packages/ui/src/components/primitives/badge.tsx | cva | ✅ | Status variants included |
| Alert | ReadyLayer pattern | /packages/ui/src/components/primitives/alert.tsx | cva | ✅ | Severity levels |
| Input | ReadyLayer/components/ui/input.tsx | /packages/ui/src/components/primitives/input.tsx | - | ✅ | Form primitive |
| Textarea | ReadyLayer/components/ui/textarea.tsx | /packages/ui/src/components/primitives/textarea.tsx | - | ✅ | Form primitive |
| Tabs | ReadyLayer/components/ui/tabs.tsx | /packages/ui/src/components/primitives/tabs.tsx | @radix-ui/react-tabs | ✅ | Radix Tabs primitive |

### Tier 2: Layout & Structure

| Component | Origin | New Location | Dependencies | OSS Safe | Notes |
|-----------|--------|--------------|--------------|----------|-------|
| AppShell | ReadyLayer/app-layout + Reach/StudioShell | /packages/ui/src/components/layout/app-shell.tsx | - | ✅ | Header/Sidebar/Footer slots |
| PageHeader | ReadyLayer pattern | /packages/ui/src/components/layout/app-shell.tsx | - | ✅ | Title/description/actions |
| EmptyState | Reach/EmptyState + ReadyLayer | /packages/ui/src/components/layout/empty-state.tsx | - | ✅ | Icon + title + desc + action |
| ErrorBoundary | ReadyLayer/components/error-boundary.tsx | /packages/ui/src/components/layout/error-boundary.tsx | - | ✅ | Prevents hard-500 errors |
| LoadingSpinner | ReadyLayer pattern | /packages/ui/src/components/layout/loading-state.tsx | - | ✅ | Size variants |
| Skeleton | ReadyLayer pattern | /packages/ui/src/components/layout/loading-state.tsx | - | ✅ | Card/line variants |

### Tier 3: Data & Observability

| Component | Origin | New Location | Dependencies | OSS Safe | Notes |
|-----------|--------|--------------|--------------|----------|-------|
| MetricCard | ReadyLayer/metrics-card + Reach | /packages/ui/src/components/data/metric-card.tsx | - | ✅ | Number formatting built-in |
| StatusPill | ReadyLayer/badge + Reach/StatusIndicator | /packages/ui/src/components/data/status-pill.tsx | cva | ✅ | Operational status states |
| DeterminismPill | Reach pattern | /packages/ui/src/components/data/status-pill.tsx | - | ✅ | High/med/low confidence |

---

## Design Tokens

### Harvested From: ReadyLayer/app/globals.css

| Token Category | Variables | Location | Notes |
|----------------|-----------|----------|-------|
| Surfaces | --surface, --surface-*, --surface-code | /packages/ui/src/styles/tokens.css | Layered elevation system |
| Text | --text, --text-muted, --text-subtle | /packages/ui/src/styles/tokens.css | Clear hierarchy |
| Borders | --border, --border-strong | /packages/ui/src/styles/tokens.css | Subtle vs emphasis |
| Accent/Brand | --accent, --accent-hover | /packages/ui/src/styles/tokens.css | Requiem blue |
| Status | --success, --warning, --danger, --info | /packages/ui/src/styles/tokens.css | WCAG AA compliant |
| Radius | --radius-sm/md/lg/xl | /packages/ui/src/styles/tokens.css | Consistent rounding |

### Themes Supported
1. **Light Mode** (default) - Professional IDE-grade palette
2. **Dark Mode** - Separately tuned, not inverted
3. **High Contrast** (.hc class) - Maximum accessibility

---

## Utilities

| Utility | Origin | New Location | Notes |
|---------|--------|--------------|-------|
| cn() | ReadyLayer/lib/utils.ts | /packages/ui/src/lib/utils.ts | clsx + tailwind-merge |
| formatNumber() | ReadyLayer/lib/utils.ts | /packages/ui/src/lib/utils.ts | Compact notation |
| formatDate() | ReadyLayer/lib/utils.ts | /packages/ui/src/lib/utils.ts | Intl.DateTimeFormat |
| formatRelativeTime() | ReadyLayer/lib/utils.ts | /packages/ui/src/lib/utils.ts | "2 hours ago" style |
| formatDuration() | ReadyLayer pattern | /packages/ui/src/lib/utils.ts | ms → readable |
| formatBytes() | ReadyLayer pattern | /packages/ui/src/lib/utils.ts | B/KB/MB/GB/TB |
| debounce() | ReadyLayer/lib/utils.ts | /packages/ui/src/lib/utils.ts | Generic debounce |
| hashKey() | New | /packages/ui/src/lib/utils.ts | React key helper |
| uniqueId() | New | /packages/ui/src/lib/utils.ts | a11y ID generation |

---

## Dependencies Map

### Required Peer Dependencies
```json
{
  "react": "^18.0.0 || ^19.0.0",
  "react-dom": "^18.0.0 || ^19.0.0",
  "tailwindcss": "^3.0.0"
}
```

### Core Dependencies
```json
{
  "@radix-ui/react-slot": "^1.0.2",
  "@radix-ui/react-tabs": "^1.0.4",
  "class-variance-authority": "^0.7.0",
  "clsx": "^2.0.0",
  "tailwind-merge": "^2.0.0"
}
```

### Optional Dependencies
```json
{
  "framer-motion": "^11.0.0",    // For animation variants
  "lucide-react": "^0.300.0",    // For icon support
  "recharts": "^2.10.0"          // For chart wrappers
}
```

---

## Enterprise Gating

### OSS Safe (Default Export)
- All primitive components
- All layout components
- All data display components
- Utility functions

### Enterprise Only (/enterprise subpath)
- TenantSwitcher
- RoleBadge
- AuditLogViewer
- BillingMeter

### Boundary Enforcement
```bash
# Verify no enterprise leakage
npm run verify:boundaries
```

---

## Components NOT Harvested (And Why)

| Component | Source | Reason |
|-----------|--------|--------|
| ExecutionTimeline (full) | Reach | Too domain-specific to execution engine |
| PackCard (detailed) | Reach | Tightly coupled to Pack domain model |
| AgentTable | Reach | Requires Agent domain types |
| TraceTimeline | Reach | Requires Trace/Execution domain |
| Chart wrappers | ReadyLayer | Recharts dependency kept optional |
| Modal/Dialog | ReadyLayer | Requires Radix Dialog + complex state |
| Toast | ReadyLayer | Requires Radix Toast + provider setup |
| Dropdown Menu | ReadyLayer | Requires Radix Dropdown |

These components have **extension hooks** in place - future agents can harvest them as needed following the established patterns.

---

## Extension Hooks

### For Claude/Codex Follow-up

1. **Add Complex Components**
   - Path: /packages/ui/src/components/complex/
   - Candidates: Table, Command Palette, Date Picker

2. **Add Chart Wrappers**
   - Path: /packages/ui/src/components/charts/
   - Note: Keep recharts as optional peer dependency

3. **Add Animation Variants**
   - Path: /packages/ui/src/lib/motion.ts
   - Source: ReadyLayer/lib/design/motion.ts

### For Gemini UI Polish

1. **Dark Mode Refinement**
   - Review contrast ratios in tokens.css
   - Add more surface levels if needed

2. **High Contrast Mode**
   - Test .hc class variations
   - Add Windows High Contrast support

3. **Accessibility Audit**
   - Run axe-core on all components
   - Add aria-* props where missing

---

## Migration Path

### For Reach
1. Install: `npm install @requiem/ui`
2. Replace: `import { Button } from '@/components/ui/button'`
3. With: `import { Button } from '@requiem/ui'`
4. Tokens: Import `@requiem/ui/styles` in layout

### For ReadyLayer
1. Install: `npm install @requiem/ui`
2. Gradual migration of shared components
3. Keep app-specific components local

---

## Build Verification

```bash
cd packages/ui
npm run verify    # typecheck + lint + build
npm run build     # TypeScript compilation + CSS copy
```

## Next Steps

1. Add Table component with sorting/filtering
2. Add Command Palette (Cmd+K) pattern
3. Add Chart wrappers for Recharts
4. Add Storybook/Vite sandbox
5. Add E2E tests with Playwright

---

*This document is a living reference. Update it when harvesting new components.*
