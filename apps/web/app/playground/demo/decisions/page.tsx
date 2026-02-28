/**
 * Decisions Page - Demo view of decision reports and traces
 */

import { getDemoEngine } from '@/lib/demo-engine';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Decisions | Reach OSS Demo',
  description: 'View decision reports, ranked actions, and evaluation traces',
};

export default async function DecisionsPage() {
  let decisions: Awaited<ReturnType<ReturnType<typeof getDemoEngine>['getDecisions']>> = [];
  let error: string | null = null;

  try {
    const engine = getDemoEngine();
    decisions = engine.getDecisions();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load decisions';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Decisions</h1>
              <p className="text-gray-600 mt-1">
                Decision reports with ranked actions and evaluation traces
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

        {decisions.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="text-4xl mb-4">⚖️</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Decisions Yet</h3>
            <p className="text-gray-500 mb-6">
              Decisions are created when junctions are evaluated by the decision engine
            </p>
            <a
              href="/demo"
              className="inline-flex items-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
            >
              Go to Demo Hub to Evaluate Decisions
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {decisions.map((decision) => (
              <div
                key={decision.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Decision: {decision.decision_output?.selected_option || 'Pending'}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Source: {decision.source_type} / {decision.source_ref}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 text-sm rounded-full font-medium ${
                      decision.status === 'evaluated' ? 'bg-blue-100 text-blue-700' :
                      decision.status === 'accepted' ? 'bg-green-100 text-green-700' :
                      decision.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {decision.status}
                    </span>
                  </div>
                </div>

                {decision.decision_output && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-xs text-gray-500">Selected Option</p>
                      <p className="text-sm font-medium text-gray-900">{decision.decision_output.selected_option}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Confidence</p>
                      <p className="text-sm font-medium text-gray-900">
                        {Math.round(decision.decision_output.confidence * 100)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Risk Assessment</p>
                      <p className="text-sm font-medium text-gray-900">{decision.decision_output.risk_assessment}</p>
                    </div>
                    <div className="col-span-2 md:col-span-3">
                      <p className="text-xs text-gray-500">Reasoning</p>
                      <p className="text-sm text-gray-900">{decision.decision_output.reasoning}</p>
                    </div>
                  </div>
                )}

                {/* Decision Trace */}
                {decision.decision_trace && decision.decision_trace.length > 0 && (
                  <div className="border-t border-gray-100 pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Decision Trace</h4>
                    <div className="space-y-2">
                      {decision.decision_trace.map((step) => (
                        <div key={step.step} className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600">
                            {step.step}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{step.thought}</p>
                            <p className="text-xs text-gray-500">{step.decision}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-xs text-gray-400 font-mono">
                    Fingerprint: {decision.input_fingerprint}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(decision.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
