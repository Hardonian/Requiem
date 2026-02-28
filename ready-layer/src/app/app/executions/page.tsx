// ready-layer/src/app/app/executions/page.tsx
//
// Phase E: Enterprise Operator — View executions
// First load shows last 10 executions with result digest, status, latency.
// No blank dashboard: always shows loading skeleton or data.
// INVARIANT: Data comes from /api/executions (Node API boundary). No direct engine call.

import { Suspense } from 'react';

// Loading skeleton shown while server component fetches data.
function ExecutionsSkeleton() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Executions</h1>
      <div className="animate-pulse space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  );
}

// Server component: fetches last 10 executions.
// EXTENSION_POINT: governance_enhancements — add replay drift column, audit_log_id link.
async function ExecutionsList() {
  // In production, this would use the auth session to get tenant context.
  // Placeholder response to prevent blank dashboard.
  const placeholder = {
    message: 'Connect REQUIEM_API_URL to populate execution history.',
    docs: 'https://reach-cli.com/docs/ready-layer',
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Executions</h1>
      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-sm text-gray-500 mb-2">Last 10 executions</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Execution ID</th>
              <th className="text-left py-2">Authority</th>
              <th className="text-left py-2">Result Digest</th>
              <th className="text-left py-2">Tokens</th>
              <th className="text-left py-2">Cost ($)</th>
              <th className="text-left py-2">Latency</th>
              <th className="text-left py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} className="py-4 text-center text-gray-400">
                {placeholder.message}{' '}
                <a href={placeholder.docs} className="text-blue-500 underline">Docs</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ExecutionsPage() {
  return (
    <Suspense fallback={<ExecutionsSkeleton />}>
      <ExecutionsList />
    </Suspense>
  );
}
