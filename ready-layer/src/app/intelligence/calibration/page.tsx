import type { Metadata } from 'next';
import { getCalibration } from '@/lib/intelligence-store';

export const metadata: Metadata = {
  title: 'Calibration',
  description: 'Per-claim-type calibration curves and Brier score breakdown.',
};

interface Props {
  searchParams: Promise<{ tenant?: string; claim_type?: string; window?: string }>;
}

export default async function CalibrationPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenantId = params.tenant ?? 'public';
  const rows = getCalibration(tenantId, params.claim_type, params.window);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
            Calibration
          </h1>
          <p className="text-muted text-sm mt-1">
            Per-claim-type calibration curves and Brier score breakdown.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-elevated border border-border rounded-full text-xs font-medium text-muted">
            Tenant: <span className="font-mono ml-1">{tenantId}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-elevated border border-border rounded-full text-xs font-medium text-muted">
            Window: <span className="font-mono ml-1">{params.window ?? 'all'}</span>
          </span>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="stitch-section-header">
          <h2 className="stitch-section-title">Calibration Records</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="stitch-table">
            <thead>
              <tr>
                <th>Claim Type</th>
                <th>Model</th>
                <th className="text-right">Count</th>
                <th className="text-right">Avg Brier</th>
                <th className="text-right">Sharpness</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
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
                          d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
                        />
                      </svg>
                      <p className="text-sm font-semibold text-foreground mb-1">
                        No calibration data
                      </p>
                      <p className="text-sm text-muted">
                        Calibration records are written by the intelligence pipeline. Set{' '}
                        <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono">
                          REQUIEM_INTELLIGENCE_STORE_DIR
                        </code>{' '}
                        to load stored records.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={`${row.claim_type}-${row.model_fingerprint}`}>
                    <td className="font-mono text-xs">{row.claim_type}</td>
                    <td className="font-mono text-xs text-muted truncate max-w-[200px]">
                      {row.model_fingerprint}
                    </td>
                    <td className="text-right font-mono">{row.count}</td>
                    <td className="text-right font-mono">{row.avg_brier.toFixed(4)}</td>
                    <td className="text-right font-mono">{row.sharpness.toFixed(4)}</td>
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
