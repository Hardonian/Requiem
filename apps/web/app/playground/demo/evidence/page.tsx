/**
 * Evidence Page - Demo view of proof artifacts and hashes
 */

import { getDemoEngine } from '@/lib/demo-engine';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Evidence | Reach OSS Demo',
  description: 'Proof artifacts, hashes, and source references',
};

export default async function EvidencePage() {
  let junctions: Awaited<ReturnType<ReturnType<typeof getDemoEngine>['getJunctions']>> = [];
  let decisions: Awaited<ReturnType<ReturnType<typeof getDemoEngine>['getDecisions']>> = [];
  let error: string | null = null;

  try {
    const engine = getDemoEngine();
    junctions = engine.getJunctions();
    decisions = engine.getDecisions();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load evidence';
  }

  const hasData = junctions.length > 0 || decisions.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Evidence Chain</h1>
              <p className="text-gray-600 mt-1">
                Proof artifacts, cryptographic hashes, and source references
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

        {!hasData ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="text-4xl mb-4">🔐</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Evidence Yet</h3>
            <p className="text-gray-500 mb-6">
              Evidence is generated from junctions and decisions in the demo workflow
            </p>
            <a
              href="/demo"
              className="inline-flex items-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
            >
              Go to Demo Hub to Generate Evidence
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Evidence Chain Visualization */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Evidence Chain</h3>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {['Input', 'Policy', 'Artifacts', 'Execution', 'Output', 'Fingerprint'].map((step, i) => (
                  <div key={step} className="flex items-center gap-2 flex-shrink-0">
                    <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-700">
                      {step}
                    </div>
                    {i < 5 && (
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Junction Evidence */}
            {junctions.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Junction Evidence</h3>
                <div className="space-y-3">
                  {junctions.map((junction) => (
                    <div key={junction.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">{junction.title}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          junction.severity === 'critical' ? 'bg-red-100 text-red-700' :
                          junction.severity === 'error' ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {junction.severity}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-gray-500">Source Ref</p>
                          <p className="text-xs font-mono text-gray-900">{junction.source_ref}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Trigger Type</p>
                          <p className="text-xs text-gray-900">{junction.trigger_type}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Decision Evidence */}
            {decisions.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Decision Evidence</h3>
                <div className="space-y-3">
                  {decisions.map((decision) => (
                    <div key={decision.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">
                          Decision: {decision.decision_output?.selected_option || 'Pending'}
                        </span>
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                          {decision.status}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Input Fingerprint</p>
                        <p className="text-xs font-mono text-gray-900 break-all">{decision.input_fingerprint}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
