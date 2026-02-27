/**
 * Input Component
 * 
 * HARVESTED_FROM: ReadyLayer/components/ui/input.tsx
 * EXTENSION_POINT: Add new input variants or sizes
 * 
 * A text input field with consistent styling.
 */

import * as React from 'react'
import { cn } from '../../lib/utils'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm ' +
          'ring-offset-surface file:border-0 file:bg-transparent file:text-sm file:font-medium ' +
          'placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 ' +
          'focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
