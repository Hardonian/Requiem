'use client';
// ready-layer/src/app/error.tsx
//
// Global error boundary for the App Router.
// INVARIANT: Must be a Client Component (Next.js requirement).
// INVARIANT: Never render stack traces or internal error details.

import { useEffect } from 'react';
import Link from 'next/link';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[GlobalError]', error.digest ?? 'no-digest');
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-md">
        <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2 font-display">
          Something went wrong
        </h2>
        <p className="text-muted text-sm mb-6 leading-relaxed">
          An unexpected error occurred. Please try again or return to the home page.
        </p>
        {error.digest && (
          <p className="text-xs text-muted/60 font-mono mb-5 bg-surface-elevated px-3 py-2 rounded-lg inline-block">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:brightness-110 transition-all focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-surface border border-border text-foreground rounded-lg text-sm font-medium hover:bg-surface-elevated transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
