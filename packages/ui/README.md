# @requiem/ui

Deterministic design system for operational interfaces. Harvested from Reach and ReadyLayer, consolidated for reuse.

## Installation

```bash
npm install @requiem/ui
```

### Peer Dependencies

```bash
npm install react react-dom tailwindcss
```

### Optional Dependencies

```bash
npm install framer-motion lucide-react recharts
```

## Quick Start

### 1. Import Design Tokens

Add to your root layout or app entry:

```tsx
import '@requiem/ui/styles/tokens.css'
```

### 2. Configure Tailwind

Extend your `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss'
import requiemTheme from '@requiem/ui/tailwind.config'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // Requiem tokens are automatically available
      colors: requiemTheme.theme?.extend?.colors,
      // ...or manually configure
    },
  },
}
```

### 3. Use Components

```tsx
import { Button, Card, MetricCard, StatusPill } from '@requiem/ui'

export default function Dashboard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <StatusPill status="success">All Systems Operational</StatusPill>
        <MetricCard 
          label="Total Executions" 
          value={1234} 
          format="number"
          trend={{ value: 12, direction: 'up' }}
        />
        <Button>View Details</Button>
      </CardContent>
    </Card>
  )
}
```

## Component API

### Primitives

#### Button

```tsx
interface ButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  asChild?: boolean  // Use with Radix Slot for custom element
}
```

#### Card

```tsx
interface CardProps {
  elevation?: 'flat' | 'raised' | 'overlay'
}

// Compound component pattern
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>
```

#### Badge / StatusPill

```tsx
interface BadgeProps {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 
            'success' | 'warning' | 'info'
}

interface StatusPillProps {
  status?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' |
           'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  icon?: React.ReactNode
}
```

### Layout

#### AppShell

```tsx
interface AppShellProps {
  header?: React.ReactNode
  sidebar?: React.ReactNode
  footer?: React.ReactNode
}

<AppShell
  header={<TopNav />}
  sidebar={<Sidebar />}
  footer={<Footer />}
>
  <PageContent />
</AppShell>
```

#### ErrorBoundary

```tsx
<ErrorBoundary
  fallback={<CustomErrorView />}
  onError={(error, errorInfo) => logError(error)}
>
  <YourComponent />
</ErrorBoundary>
```

### Data Display

#### MetricCard

```tsx
interface MetricCardProps {
  label: string
  value: number | string
  format?: 'number' | 'percentage' | 'bytes' | 'duration' | 'raw'
  trend?: {
    value: number
    direction: 'up' | 'down' | 'neutral'
    label?: string
  }
  icon?: React.ReactNode
  loading?: boolean
}
```

#### DeterminismPill

```tsx
<DeterminismPill confidence="high" />   // Green
<DeterminismPill confidence="medium" /> // Blue
<DeterminismPill confidence="low" />    // Yellow
```

## Design Tokens

### Color System

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--surface` | White | #0a0a0c | App background |
| `--surface-raised` | White | #1a1d29 | Cards, panels |
| `--text` | Near black | Near white | Primary text |
| `--text-muted` | Gray-500 | Gray-400 | Secondary text |
| `--accent` | Blue-500 | Blue-500 | Primary actions |
| `--success` | Green-500 | Green-500 | Positive status |
| `--warning` | Amber-500 | Amber-500 | Caution status |
| `--danger` | Red-500 | Red-500 | Error status |

### CSS Variables

All tokens are available as CSS custom properties:

```css
.my-component {
  background: hsl(var(--surface-raised));
  color: hsl(var(--text));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
}
```

### Tailwind Classes

Token classes follow the pattern `{category}-{token}`:

```html
<div class="bg-surface-raised text-text-primary border-border">
  <span class="text-success">Success</span>
  <span class="text-warning">Warning</span>
  <span class="text-danger">Error</span>
</div>
```

## Theming

### Dark Mode

Add `.dark` class to `<html>` or a container:

```tsx
<html className="dark">
  <body>...</body>
</html>
```

### High Contrast Mode

Add `.hc` class for accessibility:

```tsx
<html className="hc">      {/* Light high contrast */}
<html className="dark hc">  {/* Dark high contrast */}
```

### Programmatic Theme

```tsx
import { useEffect } from 'react'

function ThemeProvider({ children }) {
  useEffect(() => {
    document.documentElement.classList.toggle('dark', prefersDark)
  }, [prefersDark])
  
  return children
}
```

## Accessibility

### Built-in Features

- **Focus rings**: Visible focus states on all interactive elements
- **Color contrast**: WCAG AA compliant color combinations
- **Reduced motion**: Respects `prefers-reduced-motion`
- **Semantic HTML**: Proper heading hierarchy and landmarks
- **ARIA attributes**: Included where needed

### Requirements for Consumers

- Use semantic HTML (`<main>`, `<nav>`, `<header>`, etc.)
- Maintain proper heading hierarchy (h1 → h2 → h3)
- Add `aria-label` to icon-only buttons
- Test with keyboard navigation

## Enterprise Usage

Enterprise components are available via subpath import:

```tsx
import { TenantSwitcher } from '@requiem/ui/enterprise'
```

⚠️ **Boundary Check**: The `verify:boundaries` script ensures enterprise components aren't used in OSS code paths.

## OSS vs Enterprise Boundaries

| Export Path | Components | License |
|-------------|------------|---------|
| `@requiem/ui` | Primitives, Layout, Data | MIT (OSS) |
| `@requiem/ui/enterprise` | Tenant, Billing, Audit | Enterprise |

## Utilities

### cn() - Class Name Merge

```tsx
import { cn } from '@requiem/ui'

const classes = cn(
  'base-class',
  isActive && 'active-class',
  { 'conditional-class': condition }
)
```

### Formatters

```tsx
import { 
  formatNumber,      // 1234 → "1.2K"
  formatDate,        // Date → "Jan 1, 2024"
  formatRelativeTime,// Date → "2 hours ago"
  formatDuration,    // ms → "1m 30s"
  formatBytes        // bytes → "1.5 MB"
} from '@requiem/ui'
```

## Do Not Break

These invariants must be maintained:

1. **Determinism**: UI renders identically for same props (no randomness)
2. **SSR Safe**: All components work with server-side rendering
3. **No Hard-500**: ErrorBoundary prevents page crashes
4. **No Business Logic**: UI components are data-driven via props only
5. **No Env Vars**: Components don't read from process.env

## Extension Points

Safe areas for customization:

```tsx
// Add variants via cva
const myButtonVariants = cva(
  buttonVariants({ variant: 'default' }),
  {
    variants: {
      myVariant: { custom: 'custom-class' }
    }
  }
)

// Extend with wrapper
function MyButton({ customProp, ...props }: MyButtonProps) {
  return <Button {...props} className={customProp ? 'custom' : ''} />
}
```

## Development

```bash
cd packages/ui

# Install dependencies
npm install

# Type check
npm run typecheck

# Build
npm run build

# Full verification
npm run verify
```

## Troubleshooting

### Tokens not applying

Ensure you import the CSS file:
```tsx
import '@requiem/ui/styles/tokens.css'
```

### Tailwind classes not working

Add the package to your `content` array:
```js
content: [
  './node_modules/@requiem/ui/dist/**/*.js',
  // ... your files
]
```

### TypeScript errors

Check that you have the required peer dependencies:
```bash
npm install react react-dom @types/react @types/react-dom
```

## License

MIT - See LICENSE file for details.
