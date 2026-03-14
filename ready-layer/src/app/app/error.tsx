'use client';
// ready-layer/src/app/app/error.tsx
//
// App-specific error boundary for dashboard routes.

import { useEffect } from 'react';
import Link from 'next/link';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[AppError]', error.digest ?? 'no-digest', error.message);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full bg-surface rounded-xl border border-border shadow-lg p-8">
        <div className="text-center">
          <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-destructive/20">
            <svg className="w-7 h-7 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2 font-display">
            Dashboard Error
          </h2>
          <p className="text-muted text-sm mb-6 leading-relaxed">
            Something went wrong loading this page. Try refreshing or return to the main dashboard.
          </p>
          {error.digest && (
            <p className="text-xs text-muted/60 font-mono mb-5 bg-surface-elevated px-3 py-2 rounded-lg">
              Error ID: {error.digest}
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:brightness-110 transition-all focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Try Again
            </button>
            <Link
              href="/app/executions"
              className="px-4 py-2 bg-surface-elevated border border-border text-foreground rounded-lg text-sm font-medium hover:bg-border/30 transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
