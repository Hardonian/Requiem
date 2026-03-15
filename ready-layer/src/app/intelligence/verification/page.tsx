import type { Metadata } from 'next';
import { getPredictions, getOutcomes } from '@/lib/intelligence-store';

export const metadata: Metadata = {
  title: 'Verification',
  description: 'Prediction accuracy, Brier scores, and outcome verification statistics.',
};

interface Props {
  searchParams: Promise<{ tenant?: string; run_id?: string }>;
}

export default async function VerificationPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenantId = params.tenant ?? 'public';
  const predictions = getPredictions(tenantId, params.run_id);
  const outcomes = getOutcomes(tenantId, params.run_id);
  const avgBrier =
    outcomes.length > 0
      ? outcomes.reduce((s, o) => s + o.brier_score, 0) / outcomes.length
      : null;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
            Verification
          </h1>
          <p className="text-muted text-sm mt-1">
            Prediction accuracy and Brier score calibration.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-elevated border border-border rounded-full text-xs font-medium text-muted">
          Tenant: <span className="font-mono ml-1">{tenantId}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="stitch-stat">
          <p className="stitch-stat-label">Predictions</p>
          <span className="stitch-stat-value font-mono">
            {predictions.length > 0 ? predictions.length : '\u2014'}
          </span>
          <p className="stitch-stat-sub">Recorded predictions</p>
        </div>
        <div className="stitch-stat">
          <p className="stitch-stat-label">Outcomes</p>
          <span className="stitch-stat-value font-mono">
            {outcomes.length > 0 ? outcomes.length : '\u2014'}
          </span>
          <p className="stitch-stat-sub">Finalized outcomes</p>
        </div>
        <div className="stitch-stat">
          <p className="stitch-stat-label">Avg Brier Score</p>
          <span className="stitch-stat-value font-mono">
            {avgBrier !== null ? avgBrier.toFixed(4) : '\u2014'}
          </span>
          <p className="stitch-stat-sub">Lower is better (0&ndash;1)</p>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="stitch-section-header">
          <h2 className="stitch-section-title">Recent Outcomes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="stitch-table">
            <thead>
              <tr>
                <th>Outcome ID</th>
                <th>Prediction ID</th>
                <th>Observed</th>
                <th>Brier Score</th>
                <th>Finalized</th>
              </tr>
            </thead>
            <tbody>
              {outcomes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="max-w-sm mx-auto">
                      <svg
                        className="mx-auto h-10 w-10 text-muted/30 mb-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z"
                        />
                      </svg>
                      <p className="text-sm font-semibold text-foreground mb-1">
                        No outcomes recorded
                      </p>
                      <p className="text-sm text-muted">
                        Outcomes are populated when predictions resolve. Set{' '}
                        <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono">
                          REQUIEM_INTELLIGENCE_STORE_DIR
                        </code>{' '}
                        to load stored data.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                outcomes.map((o) => (
                  <tr key={o.outcome_id}>
                    <td className="font-mono text-xs">{o.outcome_id.slice(0, 8)}&hellip;</td>
                    <td className="font-mono text-xs">{o.prediction_id.slice(0, 8)}&hellip;</td>
                    <td>{o.observed === 1 ? 'true' : 'false'}</td>
                    <td className="font-mono">{o.brier_score.toFixed(4)}</td>
                    <td className="text-muted">{o.finalized_at}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
