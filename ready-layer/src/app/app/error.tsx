'use client';
// ready-layer/src/app/app/error.tsx
//
// App-specific error boundary for the dashboard routes.
// Provides dashboard-specific recovery options.

import { useEffect } from 'react';
import Link from 'next/link';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to error monitoring
    console.error('[AppError]', error.digest ?? 'no-digest', error.message);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50/50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Dashboard Error
          </h2>
          <p className="text-slate-500 mb-6 text-sm">
            Something went wrong loading this dashboard. Try refreshing or return to the main dashboard.
          </p>
          {error.digest && (
            <p className="text-xs text-slate-400 font-mono mb-6 bg-slate-50 px-3 py-2 rounded-lg">
              Error ID: {error.digest}
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            <Link
              href="/app/executions"
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
