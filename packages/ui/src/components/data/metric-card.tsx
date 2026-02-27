/**
 * MetricCard Component
 * 
 * HARVESTED_FROM: ReadyLayer/components/ui/metrics-card.tsx, Reach/apps/arcade/src/components/ExecutionDetails.tsx
 * EXTENSION_POINT: Add sparkline charts, trend indicators, or comparison values
 * 
 * Displays a single metric with label, value, and optional trend.
 */

import * as React from 'react'
import { cn, formatNumber } from '../../lib/utils'

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
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

const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(
  ({ className, label, value, format = 'raw', trend, icon, loading = false, ...props }, ref) => {
    const formatValue = (val: number | string): string => {
      if (typeof val === 'string') return val
      switch (format) {
        case 'number':
          return formatNumber(val)
        case 'percentage':
          return `${val.toFixed(1)}%`
        case 'bytes':
          return formatBytes(val)
        case 'duration':
          return formatDuration(val)
        default:
          return String(val)
      }
    }

    if (loading) {
      return (
        <div
          ref={ref}
          className={cn(
            'rounded-lg border border-border bg-surface-raised p-6 animate-pulse',
            className
          )}
          {...props}
        >
          <div className="h-4 w-20 bg-surface-muted rounded" />
          <div className="mt-2 h-8 w-32 bg-surface-muted rounded" />
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg border border-border bg-surface-raised p-6',
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-text-muted">{label}</p>
          {icon && <div className="text-text-muted">{icon}</div>}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <p className="text-3xl font-semibold text-text-primary">
            {formatValue(value)}
          </p>
          {trend && (
            <span
              className={cn(
                'text-sm font-medium',
                trend.direction === 'up' && 'text-success',
                trend.direction === 'down' && 'text-danger',
                trend.direction === 'neutral' && 'text-text-muted'
              )}
            >
              {trend.direction === 'up' && '↑'}
              {trend.direction === 'down' && '↓'}
              {trend.direction === 'neutral' && '→'}
              {Math.abs(trend.value)}%
              {trend.label && ` ${trend.label}`}
            </span>
          )}
        </div>
      </div>
    )
  }
)
MetricCard.displayName = 'MetricCard'

// Helper functions (duplicated from utils for standalone usage)
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`
}

export { MetricCard }
