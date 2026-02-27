/**
 * StatusPill Component
 * 
 * HARVESTED_FROM: ReadyLayer/components/ui/badge.tsx (pattern), Reach/apps/arcade/src/components/StatusIndicator.tsx
 * EXTENSION_POINT: Add new status types or animation states
 * 
 * A compact status indicator with icon support for operational states.
 */

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const statusPillVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      status: {
        success: 'bg-success-muted text-success border border-success/20',
        warning: 'bg-warning-muted text-warning border border-warning/20',
        danger: 'bg-danger-muted text-danger border border-danger/20',
        info: 'bg-info-muted text-info border border-info/20',
        neutral: 'bg-surface-muted text-text-muted border border-border',
        pending: 'bg-surface-muted text-text-muted border border-border animate-pulse',
        running: 'bg-info-muted text-info border border-info/20',
        completed: 'bg-success-muted text-success border border-success/20',
        failed: 'bg-danger-muted text-danger border border-danger/20',
        cancelled: 'bg-surface-muted text-text-muted border border-border',
      },
    },
    defaultVariants: {
      status: 'neutral',
    },
  }
)

export interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusPillVariants> {
  icon?: React.ReactNode
  animate?: boolean
}

const StatusPill = React.forwardRef<HTMLSpanElement, StatusPillProps>(
  ({ className, status, icon, animate = false, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          statusPillVariants({ status }),
          animate && status === 'running' && 'animate-pulse',
          className
        )}
        {...props}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        {children}
      </span>
    )
  }
)
StatusPill.displayName = 'StatusPill'

// Pre-configured status pills for common operational states
const DeterminismPill = ({ 
  confidence, 
  className 
}: { 
  confidence: 'high' | 'medium' | 'low' | 'best_effort'
  className?: string 
}) => {
  const variants: Record<string, { status: StatusPillProps['status']; label: string }> = {
    high: { status: 'success', label: 'High Confidence' },
    medium: { status: 'info', label: 'Medium Confidence' },
    low: { status: 'warning', label: 'Low Confidence' },
    best_effort: { status: 'neutral', label: 'Best Effort' },
  }

  const variant = variants[confidence] ?? variants.best_effort

  return (
    <StatusPill status={variant.status} className={className}>
      {variant.label}
    </StatusPill>
  )
}

export { StatusPill, DeterminismPill, statusPillVariants }
