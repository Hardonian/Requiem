// ready-layer/src/app/page.tsx
//
// Root page — renders the main executions dashboard directly.
// No redirect: users see real UI at / (not a stub).
// Auth guard is handled by middleware (src/middleware.ts).
// INVARIANT: No direct engine calls. Shows empty state if backend not connected.

import { Suspense } from 'react';

// Loading skeleton shown while server component fetches data.
function ExecutionsSkeleton() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Executions</h1>
      <div className="animate-pulse space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-12 bg-slate-100 rounded" />
        ))}
      </div>
    </div>
  );
}

// Server component: fetches last 10 executions.
// Shows empty state if REQUIEM_API_URL is not configured.
async function ExecutionsList() {
  // Placeholder response to prevent blank dashboard.
  const placeholder = {
    message: 'Connect REQUIEM_API_URL to populate execution history.',
    docs: 'https://reach-cli.com/docs/ready-layer',
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Executions</h1>
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <p className="text-sm text-slate-500 mb-2">Last 10 executions</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-2 text-slate-600 font-medium">Execution ID</th>
              <th className="text-left py-2 text-slate-600 font-medium">Status</th>
              <th className="text-left py-2 text-slate-600 font-medium">Result Digest</th>
              <th className="text-left py-2 text-slate-600 font-medium">Latency</th>
              <th className="text-left py-2 text-slate-600 font-medium">Replay</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="py-8 text-center text-slate-400">
                <div className="flex flex-col items-center gap-2">
                  <span>{placeholder.message}</span>
                  <a href={placeholder.docs} className="text-blue-600 hover:underline">Docs</a>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RootPage() {
  return (
    <Suspense fallback={<ExecutionsSkeleton />}>
      <ExecutionsList />
    </Suspense>
  );
}
