/**
 * ErrorBoundary Component
 * 
 * HARVESTED_FROM: ReadyLayer/components/error-boundary.tsx
 * EXTENSION_POINT: Add error reporting integration or recovery options
 * 
 * Catches JavaScript errors in child components and displays a fallback UI.
 * Prevents hard-500 errors from breaking the entire app.
 */

'use client'

import * as React from 'react'
import { cn } from '../../lib/utils'

export interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.props.onError?.(error, errorInfo)
    // In production, you might log to an error reporting service here
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return <DefaultErrorFallback error={this.state.error} />
    }

    return this.props.children
  }
}

export interface ErrorFallbackProps {
  error?: Error
  onReset?: () => void
  className?: string
}

function DefaultErrorFallback({ error, onReset, className }: ErrorFallbackProps) {
  return (
    <div
      className={cn(
        'flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-danger/50 bg-danger-muted p-8 text-center',
        className
      )}
      role="alert"
    >
      <div className="mb-4 rounded-full bg-danger/10 p-3">
        <svg
          className="h-6 w-6 text-danger"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-text-primary">
        Something went wrong
      </h2>
      <p className="mt-2 text-sm text-text-muted max-w-md">
        An unexpected error occurred. Try refreshing the page or contact support if the problem persists.
      </p>
      {process.env.NODE_ENV === 'development' && error && (
        <pre className="mt-4 max-w-full overflow-auto rounded bg-surface-dark p-4 text-left text-xs text-text-inverse">
          {error.message}
          {'\n'}
          {error.stack}
        </pre>
      )}
      {onReset && (
        <button
          onClick={onReset}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
        >
          Try again
        </button>
      )}
    </div>
  )
}

export { ErrorBoundary, DefaultErrorFallback }
