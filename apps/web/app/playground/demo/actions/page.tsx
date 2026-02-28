/**
 * Actions Page - Demo view of action plans and executions
 */

import { getDemoEngine } from '@/lib/demo-engine';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Actions | Reach OSS Demo',
  description: 'View action plans, approvals, and execution journals',
};

export default async function ActionsPage() {
  let actions: Awaited<ReturnType<ReturnType<typeof getDemoEngine>['getActions']>> = [];
  let error: string | null = null;

  try {
    const engine = getDemoEngine();
    actions = engine.getActions();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load actions';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Actions</h1>
              <p className="text-gray-600 mt-1">
                Action plans, approvals, and execution journals
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

        {actions.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Actions Yet</h3>
            <p className="text-gray-500 mb-6">
              Actions are planned from decisions and executed in safe mode
            </p>
            <a
              href="/demo"
              className="inline-flex items-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
            >
              Go to Demo Hub to Plan Actions
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {actions.map((action) => (
              <div
                key={action.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Action Plan: {action.steps.length} steps
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Decision: {action.decision_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 text-sm rounded-full font-medium ${
                      action.status === 'completed' ? 'bg-green-100 text-green-700' :
                      action.status === 'executing' ? 'bg-blue-100 text-blue-700' :
                      action.status === 'planned' ? 'bg-yellow-100 text-yellow-700' :
                      action.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {action.status}
                    </span>
                    <span className={`px-3 py-1 text-sm rounded-full font-medium ${
                      action.risk_summary === 'high' ? 'bg-red-100 text-red-700' :
                      action.risk_summary === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      Risk: {action.risk_summary}
                    </span>
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-700">Steps</h4>
                  {action.steps.map((step) => (
                    <div key={step.order} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                        {step.order}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{step.description}</p>
                        {step.tool && (
                          <p className="text-xs text-gray-500 mt-1">
                            Tool: <code className="bg-gray-100 px-1 rounded">{step.tool}</code>
                          </p>
                        )}
                        {step.estimated_duration && (
                          <p className="text-xs text-gray-400 mt-1">
                            Est. duration: {step.estimated_duration}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    Created: {new Date(action.created_at).toLocaleString()}
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
