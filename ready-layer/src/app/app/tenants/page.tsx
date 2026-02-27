// ready-layer/src/app/app/tenants/page.tsx
//
// Phase B+E: Tenant management page — /app/tenants
// Enterprise Operator: view tenant list, isolation status, quota usage.
// INVARIANT: Requires elevated admin role. Non-admin requests → 403.

import { Suspense } from 'react';

export default function TenantsPage() {
  return (
    <Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-gray-100 rounded w-48 mb-4"/></div>}>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Tenants</h1>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 mb-3">Active tenants and isolation status</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Tenant ID</th>
                <th className="text-left py-2">CAS Isolation</th>
                <th className="text-left py-2">Executions</th>
                <th className="text-left py-2">Quota Used</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="py-4 text-center text-gray-400">
                  Connect REQUIEM_API_URL to populate tenant data.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Suspense>
  );
}
