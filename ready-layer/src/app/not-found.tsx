// ready-layer/src/app/not-found.tsx
//
// Global 404 page.

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">404</h1>
        <p className="text-slate-500 mb-6">Page not found.</p>
        <Link
          href="/app/executions"
          className="text-blue-600 hover:underline text-sm"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
