/**
 * Button Component
 * 
 * HARVESTED_FROM: ReadyLayer/components/ui/button.tsx
 * EXTENSION_POINT: Add new variants in buttonVariants, new sizes as needed
 * 
 * A versatile button component with multiple variants and sizes.
 * Uses Radix Slot for composition support.
 */

'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50 ' +
  'disabled:cursor-not-allowed active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 
          'bg-accent text-accent-foreground hover:bg-accent-hover shadow-surface-raised',
        destructive: 
          'bg-danger text-danger-foreground hover:bg-danger/90 shadow-surface-raised',
        outline: 
          'border border-border-strong bg-surface-raised hover:bg-surface-hover hover:border-border-strong',
        secondary: 
          'bg-surface-muted text-text-primary hover:bg-surface-hover shadow-surface-raised',
        ghost: 
          'hover:bg-surface-hover text-text-primary',
        link: 
          'text-accent underline-offset-4 hover:underline hover:text-accent-hover',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-md px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
