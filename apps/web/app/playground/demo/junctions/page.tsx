/**
 * Junctions Page - Demo view of junction triggers and traces
 */

import { getDemoEngine } from '@/lib/demo-engine';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Junctions | Reach OSS Demo',
  description: 'View junction triggers, severity levels, and trace details',
};

export default async function JunctionsPage() {
  let junctions: Awaited<ReturnType<ReturnType<typeof getDemoEngine>['getJunctions']>> = [];
  let error: string | null = null;

  try {
    const engine = getDemoEngine();
    junctions = engine.getJunctions();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load junctions';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Junctions</h1>
              <p className="text-gray-600 mt-1">
                Trigger traces, severity levels, and policy evaluations
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

        {junctions.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Junctions Yet</h3>
            <p className="text-gray-500 mb-6">
              Junctions appear when policy violations, drift, or diffs are detected
            </p>
            <a
              href="/demo"
              className="inline-flex items-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
            >
              Go to Demo Hub to Generate Junctions
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {junctions.map((junction) => (
              <div
                key={junction.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{junction.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">{junction.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 text-sm rounded-full font-medium ${
                      junction.severity === 'critical' ? 'bg-red-100 text-red-700' :
                      junction.severity === 'error' ? 'bg-orange-100 text-orange-700' :
                      junction.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {junction.severity}
                    </span>
                    <span className={`px-3 py-1 text-sm rounded-full font-medium ${
                      junction.status === 'open' ? 'bg-blue-100 text-blue-700' :
                      junction.status === 'resolved' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {junction.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500">ID</p>
                    <p className="text-sm font-mono text-gray-900 truncate">{junction.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Trigger Type</p>
                    <p className="text-sm text-gray-900">{junction.trigger_type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Source Ref</p>
                    <p className="text-sm font-mono text-gray-900 truncate">{junction.source_ref}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Created</p>
                    <p className="text-sm text-gray-900">
                      {new Date(junction.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Trace */}
                <div className="border-t border-gray-100 pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Trigger Trace</h4>
                  <div className="space-y-2">
                    {junction.trace.map((step) => (
                      <div key={step.step} className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                          {step.step}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{step.event}</p>
                          <p className="text-xs text-gray-500">{step.detail}</p>
                          <p className="text-xs text-gray-400">{new Date(step.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
