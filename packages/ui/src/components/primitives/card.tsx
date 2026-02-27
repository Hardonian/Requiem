/**
 * Card Component
 * 
 * HARVESTED_FROM: ReadyLayer/components/ui/card.tsx
 * EXTENSION_POINT: Add new elevation variants or padding options
 * 
 * A flexible card component with header, content, and footer sections.
 */

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const cardVariants = cva(
  'rounded-lg border bg-surface-raised text-text-primary transition-all',
  {
    variants: {
      elevation: {
        flat: 'border-border-subtle shadow-none',
        raised: 'border-border-subtle shadow-surface-raised hover:shadow-surface-overlay',
        overlay: 'border-border-strong shadow-surface-overlay',
      },
    },
    defaultVariants: {
      elevation: 'raised',
    },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevation, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(cardVariants({ elevation, className }))}
        {...props}
      />
    )
  }
)
Card.displayName = 'Card'

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'default' | 'compact' | 'none'
}

const CardHeader = React.forwardRef<
  HTMLDivElement,
  CardHeaderProps
>(({ className, padding = 'default', ...props }, ref) => {
  const paddingClasses = {
    default: 'p-6',
    compact: 'p-4',
    none: 'p-0',
  }
  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-col space-y-1.5',
        paddingClasses[padding],
        className
      )}
      {...props}
    />
  )
})
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-snug tracking-tight',
      className
    )}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-text-muted leading-relaxed', className)}
    {...props}
  />
))
CardDescription.displayName = 'CardDescription'

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'default' | 'compact' | 'none'
}

const CardContent = React.forwardRef<
  HTMLDivElement,
  CardContentProps
>(({ className, padding = 'default', ...props }, ref) => {
  const paddingClasses = {
    default: 'p-6 pt-0',
    compact: 'p-4 pt-0',
    none: 'p-0',
  }
  return (
    <div
      ref={ref}
      className={cn(paddingClasses[padding], className)}
      {...props}
    />
  )
})
CardContent.displayName = 'CardContent'

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'default' | 'compact' | 'none'
}

const CardFooter = React.forwardRef<
  HTMLDivElement,
  CardFooterProps
>(({ className, padding = 'default', ...props }, ref) => {
  const paddingClasses = {
    default: 'p-6 pt-0',
    compact: 'p-4 pt-0',
    none: 'p-0',
  }
  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center gap-2',
        paddingClasses[padding],
        className
      )}
      {...props}
    />
  )
})
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
