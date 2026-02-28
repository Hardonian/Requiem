'use client';

import { useState, useEffect } from 'react';
import { getDemoEngine, type SystemCheckResult, type Junction, type DecisionReport, type ActionPlan, type VitalsSummary, type ExportBundle } from '@/lib/demo-engine';

// Demo steps configuration
const DEMO_STEPS = [
  {
    id: 'seed',
    title: 'Seed Demo Data',
    description: 'Initialize the demo environment with sample data',
    buttonText: 'Seed Demo Data',
    apiEndpoint: '/api/demo/seed',
    completedText: 'Demo data seeded'
  },
  {
    id: 'system-check',
    title: 'Run System Check',
    description: 'Verify all system components are operational',
    buttonText: 'Run System Check',
    apiEndpoint: '/api/demo/system-check',
    completedText: 'System check passed'
  },
  {
    id: 'junctions',
    title: 'Generate Junction',
    description: 'Create a junction from policy evaluation or drift detection',
    buttonText: 'Generate Junction',
    apiEndpoint: '/api/demo/junctions',
    completedText: 'Junction generated'
  },
  {
    id: 'decide',
    title: 'Evaluate Decision',
    description: 'Run decision evaluation on a junction',
    buttonText: 'Evaluate Decision',
    apiEndpoint: '/api/demo/decisions',
    completedText: 'Decision evaluated'
  },
  {
    id: 'plan',
    title: 'Plan Action',
    description: 'Generate an action plan from a decision',
    buttonText: 'Plan Action',
    apiEndpoint: '/api/demo/actions/plan',
    completedText: 'Action planned'
  },
  {
    id: 'execute',
    title: 'Execute (Safe Mode)',
    description: 'Run a non-destructive demo action',
    buttonText: 'Execute Action',
    apiEndpoint: '/api/demo/actions/execute',
    completedText: 'Action executed'
  },
  {
    id: 'export',
    title: 'Export Bundle',
    description: 'Create a deterministic export bundle',
    buttonText: 'Export Bundle',
    apiEndpoint: '/api/demo/export',
    completedText: 'Bundle exported'
  },
  {
    id: 'verify',
    title: 'Verify Bundle',
    description: 'Verify the exported bundle integrity',
    buttonText: 'Verify Bundle',
    apiEndpoint: '/api/demo/verify',
    completedText: 'Bundle verified'
  },
  {
    id: 'replay',
    title: 'Replay Events',
    description: 'Replay events and recompute vitals',
    buttonText: 'Replay Events',
    apiEndpoint: '/api/demo/replay',
    completedText: 'Events replayed'
  }
];

export function DemoClient() {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemCheckResult | null>(null);
  const [vitals, setVitals] = useState<VitalsSummary | null>(null);
  const [junctions, setJunctions] = useState<Junction[]>([]);
  const [decisions, setDecisions] = useState<DecisionReport[]>([]);
  const [actions, setActions] = useState<ActionPlan[]>([]);
  const [bundle, setBundle] = useState<ExportBundle | null>(null);

  // Load initial state from API
  useEffect(() => {
    async function loadInitialState() {
      try {
        const response = await fetch('/api/demo/status');
        if (response.ok) {
          const data = await response.json();
          if (data.data) {
            setSystemStatus(data.data.systemStatus);
            setVitals(data.data.vitals);
            setJunctions(data.data.junctions || []);
            setDecisions(data.data.decisions || []);
            setActions(data.data.actions || []);
            if (data.data.completedSteps) {
              setCompletedSteps(new Set(data.data.completedSteps));
            }
          }
        }
      } catch (err) {
        console.log('No initial state loaded');
      }
    }
    loadInitialState();
  }, []);

  const runStep = async (stepId: string) => {
    setCurrentStep(stepId);
    setError(null);

    try {
      const step = DEMO_STEPS.find(s => s.id === stepId);
      if (!step) return;

      const response = await fetch(step.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Step failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.ok) {
        setCompletedSteps(prev => new Set([...prev, stepId]));
        
        // Update state based on step
        if (result.data) {
          if (result.data.systemStatus) setSystemStatus(result.data.systemStatus);
          if (result.data.vitals) setVitals(result.data.vitals);
          if (result.data.junctions) setJunctions(result.data.junctions);
          if (result.data.decisions) setDecisions(result.data.decisions);
          if (result.data.actions) setActions(result.data.actions);
          if (result.data.bundle) setBundle(result.data.bundle);
        }
      } else {
        throw new Error(result.error?.message || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setCurrentStep(null);
    }
  };

  const resetDemo = async () => {
    setCompletedSteps(new Set());
    setSystemStatus(null);
    setVitals(null);
    setJunctions([]);
    setDecisions([]);
    setActions([]);
    setBundle(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reach OSS Demo</h1>
              <p className="text-gray-600 mt-1">
                Experience the full decision engine suite end-to-end
              </p>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                ← Back to Home
              </a>
              <a
                href="/demo/evidence-viewer"
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Open Evidence Viewer
              </a>
              <button
                onClick={resetDemo}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Reset Demo
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Junctions"
            value={junctions.length}
            status={junctions.length > 0 ? 'success' : 'neutral'}
          />
          <StatCard
            label="Decisions"
            value={decisions.length}
            status={decisions.length > 0 ? 'success' : 'neutral'}
          />
          <StatCard
            label="Actions"
            value={actions.length}
            status={actions.length > 0 ? 'success' : 'neutral'}
          />
          <StatCard
            label="System"
            value={systemStatus?.overall_status || 'unknown'}
            status={systemStatus?.overall_status === 'pass' ? 'success' : 
                   systemStatus?.overall_status === 'warn' ? 'warning' : 'neutral'}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Demo Steps */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">Demo Workflow</h2>
            <p className="text-sm text-gray-600 mt-1">
              Follow these steps to experience the full Reach suite
            </p>
          </div>

          <div className="divide-y divide-gray-200">
            {DEMO_STEPS.map((step, index) => {
              const isCompleted = completedSteps.has(step.id);
              const isRunning = currentStep === step.id;
              const isDisabled = !completedSteps.has(DEMO_STEPS[index - 1]?.id || 'seed') && index > 0;

              return (
                <div
                  key={step.id}
                  className={`px-6 py-4 flex items-center gap-4 ${
                    isCompleted ? 'bg-green-50' : isRunning ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    isCompleted
                      ? 'bg-green-100 text-green-700'
                      : isRunning
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {isCompleted ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900">{step.title}</h3>
                    <p className="text-sm text-gray-500">{step.description}</p>
                  </div>

                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <span className="text-sm text-green-700 font-medium">
                        {step.completedText}
                      </span>
                    ) : isRunning ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-blue-600">Running...</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => runStep(step.id)}
                        disabled={isDisabled}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          isDisabled
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-900 text-white hover:bg-gray-800'
                        }`}
                      >
                        {step.buttonText}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Results Section */}
        {completedSteps.size > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Junctions */}
            {junctions.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Junctions</h3>
                <div className="space-y-3">
                  {junctions.map(junction => (
                    <div key={junction.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{junction.title}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          junction.severity === 'critical' ? 'bg-red-100 text-red-700' :
                          junction.severity === 'error' ? 'bg-orange-100 text-orange-700' :
                          junction.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {junction.severity}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{junction.id}</p>
                    </div>
                  ))}
                </div>
                <a href="/demo/junctions" className="mt-4 block text-sm text-blue-600 hover:text-blue-700">
                  View all junctions →
                </a>
              </div>
            )}

            {/* Decisions */}
            {decisions.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Decisions</h3>
                <div className="space-y-3">
                  {decisions.map(decision => (
                    <div key={decision.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">
                          {decision.decision_output?.selected_option || 'pending'}
                        </span>
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                          {decision.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Confidence: {Math.round((decision.decision_output?.confidence || 0) * 100)}%
                      </p>
                    </div>
                  ))}
                </div>
                <a href="/demo/decisions" className="mt-4 block text-sm text-blue-600 hover:text-blue-700">
                  View all decisions →
                </a>
              </div>
            )}

            {/* Actions */}
            {actions.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
                <div className="space-y-3">
                  {actions.map(action => (
                    <div key={action.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">
                          {action.steps.length} steps
                        </span>
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                          {action.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Risk: {action.risk_summary}</p>
                    </div>
                  ))}
                </div>
                <a href="/demo/actions" className="mt-4 block text-sm text-blue-600 hover:text-blue-700">
                  View all actions →
                </a>
              </div>
            )}

            {/* Bundle */}
            {bundle && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Bundle</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Bundle ID</span>
                    <span className="font-mono text-gray-900">{bundle.id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Events</span>
                    <span className="text-gray-900">{bundle.events.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Fingerprint</span>
                    <span className="font-mono text-gray-900 text-xs">{bundle.fingerprint}</span>
                  </div>
                </div>
                <a href="/demo/exports" className="mt-4 block text-sm text-blue-600 hover:text-blue-700">
                  View export details →
                </a>
              </div>
            )}
          </div>
        )}

        {/* Vitals Preview */}
        {vitals && (
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">System Vitals</h3>
              <a href="/demo/vitals" className="text-sm text-blue-600 hover:text-blue-700">
                View detailed vitals →
              </a>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{vitals.total_junctions}</p>
                <p className="text-sm text-gray-500">Total Junctions</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{vitals.total_decisions}</p>
                <p className="text-sm text-gray-500">Total Decisions</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{vitals.total_actions}</p>
                <p className="text-sm text-gray-500">Total Actions</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className={`text-2xl font-bold ${
                  vitals.system_health === 'healthy' ? 'text-green-600' :
                  vitals.system_health === 'degraded' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {vitals.system_health}
                </p>
                <p className="text-sm text-gray-500">System Health</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Stat Card component
function StatCard({ label, value, status }: { label: string; value: string | number; status: 'success' | 'warning' | 'neutral' }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${
        status === 'success' ? 'text-green-600' :
        status === 'warning' ? 'text-yellow-600' : 'text-gray-900'
      }`}>
        {value}
      </p>
    </div>
  );
}
