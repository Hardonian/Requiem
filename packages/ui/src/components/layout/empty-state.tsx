/**
 * EmptyState Component
 * 
 * HARVESTED_FROM: Reach/apps/arcade/src/components/EmptyState.tsx, ReadyLayer/components/ui/empty-state.tsx
 * EXTENSION_POINT: Add new visual styles or action button patterns
 * 
 * A placeholder for empty lists, search results, and initial states.
 */

import * as React from 'react'
import { cn } from '../../lib/utils'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center text-center p-8 rounded-lg border border-dashed border-border',
          className
        )}
        {...props}
      >
        {icon && (
          <div className="mb-4 text-text-muted">
            {icon}
          </div>
        )}
        <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
        {description && (
          <p className="mt-2 text-sm text-text-muted max-w-sm">{description}</p>
        )}
        {action && <div className="mt-6">{action}</div>}
      </div>
    )
  }
)
EmptyState.displayName = 'EmptyState'

export { EmptyState }
