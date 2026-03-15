import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Semantic Ledger',
  description: 'Immutable semantic operation ledger with cryptographic chaining.',
};

export default function SemanticLedgerPage() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
            Semantic Ledger
          </h1>
          <p className="text-muted text-sm mt-1">
            Immutable semantic operation ledger with cryptographic chaining.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-elevated border border-border rounded-full text-xs font-medium text-muted">
          Not yet available
        </span>
      </div>

      <div className="mb-6 p-5 bg-warning/5 border border-warning/20 rounded-xl flex items-start gap-4" role="alert">
        <div className="w-10 h-10 bg-warning/10 text-warning rounded-lg flex items-center justify-center shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">API route not implemented</h3>
          <p className="text-sm text-muted mt-1">
            The semantic ledger API endpoint is not available in this release. Live ledger data cannot be displayed.
            Once the backend API is available, this page will show tenant context, entry count, and chain integrity status.
          </p>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="stitch-section-header">
          <h2 className="stitch-section-title">Ledger Entries</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="stitch-table">
            <thead>
              <tr>
                <th>Entry ID</th>
                <th>Operation</th>
                <th>Subject</th>
                <th>Chain Hash</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
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
                        d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
                      />
                    </svg>
                    <p className="text-sm font-semibold text-foreground mb-1">No ledger data available</p>
                    <p className="text-sm text-muted">
                      Ledger entries will appear here once the semantic ledger API is available and{' '}
                      <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono">
                        REQUIEM_API_URL
                      </code>{' '}
                      is configured.
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-sm text-muted mt-6">
        Check{' '}
        <Link href="/app/diagnostics" className="text-accent hover:underline">
          Engine Diagnostics
        </Link>{' '}
        for current backend connectivity status.
      </p>
    </div>
  );
}
