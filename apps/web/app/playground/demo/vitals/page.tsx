/**
 * Vitals Page - Demo view of system metrics and trends
 */

import { getDemoEngine } from '@/lib/demo-engine';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Vitals | Reach OSS Demo',
  description: 'System metrics summary and trends',
};

export default async function VitalsPage() {
  let vitals: Awaited<ReturnType<ReturnType<typeof getDemoEngine>['getVitalsSummary']>> | null = null;
  let error: string | null = null;

  try {
    const engine = getDemoEngine();
    vitals = engine.getVitalsSummary();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load vitals';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Vitals</h1>
              <p className="text-gray-600 mt-1">
                System metrics summary and health indicators
              </p>
            </div>
            <a href="/demo" className="text-sm text-gray-600 hover:text-gray-900">
              ← Back to Demo
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {vitals ? (
          <>
            {/* System Health Banner */}
            <div className={`mb-6 p-4 rounded-xl border ${
              vitals.system_health === 'healthy' ? 'bg-green-50 border-green-200' :
              vitals.system_health === 'degraded' ? 'bg-yellow-50 border-yellow-200' :
              'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  vitals.system_health === 'healthy' ? 'bg-green-500' :
                  vitals.system_health === 'degraded' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`} />
                <p className={`font-medium ${
                  vitals.system_health === 'healthy' ? 'text-green-800' :
                  vitals.system_health === 'degraded' ? 'text-yellow-800' :
                  'text-red-800'
                }`}>
                  System Health: {vitals.system_health.toUpperCase()}
                </p>
                <p className="text-sm text-gray-500 ml-auto">
                  Last updated: {new Date(vitals.timestamp).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              <MetricCard
                label="Total Junctions"
                value={vitals.total_junctions}
                subValue={`${vitals.open_junctions} open`}
                color="orange"
              />
              <MetricCard
                label="Total Decisions"
                value={vitals.total_decisions}
                subValue={`${vitals.accepted_decisions} accepted`}
                color="blue"
              />
              <MetricCard
                label="Total Actions"
                value={vitals.total_actions}
                subValue={`${vitals.successful_actions} successful`}
                color="green"
              />
            </div>

            {/* Rates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Decision Rate</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Acceptance Rate</span>
                    <span className="text-sm font-medium text-gray-900">
                      {vitals.total_decisions > 0
                        ? Math.round((vitals.accepted_decisions / vitals.total_decisions) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{
                        width: `${vitals.total_decisions > 0
                          ? Math.round((vitals.accepted_decisions / vitals.total_decisions) * 100)
                          : 0}%`
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Action Success Rate</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Success Rate</span>
                    <span className="text-sm font-medium text-gray-900">
                      {vitals.total_actions > 0
                        ? Math.round((vitals.successful_actions / vitals.total_actions) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{
                        width: `${vitals.total_actions > 0
                          ? Math.round((vitals.successful_actions / vitals.total_actions) * 100)
                          : 0}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Vitals Data</h3>
            <p className="text-gray-500 mb-6">
              Vitals are computed from junctions, decisions, and actions
            </p>
            <a
              href="/demo"
              className="inline-flex items-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
            >
              Go to Demo Hub to Generate Data
            </a>
          </div>
        )}
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subValue,
  color,
}: {
  label: string;
  value: number;
  subValue: string;
  color: 'orange' | 'blue' | 'green';
}) {
  const colorClasses = {
    orange: 'text-orange-600',
    blue: 'text-blue-600',
    green: 'text-green-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <p className={`text-3xl font-bold ${colorClasses[color]}`}>{value}</p>
      <p className="text-sm font-medium text-gray-900 mt-1">{label}</p>
      <p className="text-xs text-gray-500 mt-1">{subValue}</p>
    </div>
  );
}
