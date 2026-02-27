/**
 * LoadingState Component
 * 
 * HARVESTED_FROM: ReadyLayer/components/ui/loading.tsx (pattern)
 * EXTENSION_POINT: Add skeleton variants or progress indicators
 * 
 * Loading states and skeleton placeholders.
 */

import * as React from 'react'
import { cn } from '../../lib/utils'

export interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
}

const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ className, size = 'md', ...props }, ref) => {
    const sizeClasses = {
      sm: 'h-4 w-4 border-2',
      md: 'h-8 w-8 border-2',
      lg: 'h-12 w-12 border-3',
    }

    return (
      <div
        ref={ref}
        className={cn('flex items-center justify-center', className)}
        {...props}
      >
        <div
          className={cn(
            'animate-spin rounded-full border-solid border-current border-t-transparent text-accent',
            sizeClasses[size]
          )}
        />
      </div>
    )
  }
)
LoadingSpinner.displayName = 'LoadingSpinner'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  circle?: boolean
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, circle = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'animate-pulse bg-surface-muted',
          circle ? 'rounded-full' : 'rounded-md',
          className
        )}
        {...props}
      />
    )
  }
)
Skeleton.displayName = 'Skeleton'

export interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number
}

const SkeletonCard = React.forwardRef<HTMLDivElement, SkeletonCardProps>(
  ({ className, lines = 3, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('rounded-lg border border-border p-6 space-y-4', className)}
        {...props}
      >
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full" />
          ))}
        </div>
      </div>
    )
  }
)
SkeletonCard.displayName = 'SkeletonCard'

export { LoadingSpinner, Skeleton, SkeletonCard }
