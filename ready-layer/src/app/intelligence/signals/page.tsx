import type { Metadata } from 'next';
import { getSignals } from '@/lib/intelligence-store';

export const metadata: Metadata = {
  title: 'Signals',
  description: 'Intelligence signal detection and severity classification.',
};

interface Props {
  searchParams: Promise<{ tenant?: string; severity?: 'INFO' | 'WARN' | 'CRITICAL' }>;
}

const severityStyles: Record<string, string> = {
  CRITICAL: 'bg-destructive/10 text-destructive border border-destructive/20',
  WARN: 'bg-warning/10 text-warning border border-warning/20',
  INFO: 'bg-surface-elevated text-muted border border-border',
};

export default async function SignalsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenantId = params.tenant ?? 'public';
  const rows = getSignals(tenantId, params.severity);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
            Signals
          </h1>
          <p className="text-muted text-sm mt-1">
            Intelligence signal detection and severity classification.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-elevated border border-border rounded-full text-xs font-medium text-muted">
            Tenant: <span className="font-mono ml-1">{tenantId}</span>
          </span>
          {params.severity && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-elevated border border-border rounded-full text-xs font-medium text-muted">
              Filter: <span className="font-mono ml-1">{params.severity}</span>
            </span>
          )}
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="stitch-section-header">
          <h2 className="stitch-section-title">Signal Log</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="stitch-table">
            <thead>
              <tr>
                <th>Signal Type</th>
                <th>Subject</th>
                <th>Severity</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
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
                          d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
                        />
                      </svg>
                      <p className="text-sm font-semibold text-foreground mb-1">No signals detected</p>
                      <p className="text-sm text-muted">
                        Signals are emitted by the intelligence pipeline when anomalies are detected. Set{' '}
                        <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono">
                          REQUIEM_INTELLIGENCE_STORE_DIR
                        </code>{' '}
                        to load stored data.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.signal_id}>
                    <td className="font-mono text-xs">{row.signal_type}</td>
                    <td className="text-muted truncate max-w-[240px]">{row.subject}</td>
                    <td>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${severityStyles[row.severity] ?? severityStyles['INFO']}`}
                      >
                        {row.severity}
                      </span>
                    </td>
                    <td className="text-muted font-mono text-xs">{row.timestamp}</td>
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
