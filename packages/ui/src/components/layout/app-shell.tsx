/**
 * AppShell Component
 * 
 * HARVESTED_FROM: ReadyLayer/components/layout/app-layout.tsx, Reach/apps/arcade/src/components/StudioShell.tsx
 * EXTENSION_POINT: Add new layout configurations or sidebar variants
 * 
 * The main application shell providing consistent page structure.
 */

import * as React from 'react'
import { cn } from '../../lib/utils'

export interface AppShellProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode
  sidebar?: React.ReactNode
  footer?: React.ReactNode
}

const AppShell = React.forwardRef<HTMLDivElement, AppShellProps>(
  ({ className, header, sidebar, footer, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('min-h-screen bg-surface flex flex-col', className)}
        {...props}
      >
        {header && (
          <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/60">
            {header}
          </header>
        )}
        <div className="flex flex-1">
          {sidebar && (
            <aside className="hidden md:flex w-64 flex-col border-r border-border bg-surface-muted">
              {sidebar}
            </aside>
          )}
          <main className="flex-1 flex flex-col">
            <div className="flex-1 p-6">
              {children}
            </div>
            {footer && (
              <footer className="border-t border-border py-4 px-6">
                {footer}
              </footer>
            )}
          </main>
        </div>
      </div>
    )
  }
)
AppShell.displayName = 'AppShell'

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  actions?: React.ReactNode
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ className, title, description, actions, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-6',
          className
        )}
        {...props}
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="text-text-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    )
  }
)
PageHeader.displayName = 'PageHeader'

export { AppShell, PageHeader }
