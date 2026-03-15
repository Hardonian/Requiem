import type { Metadata } from 'next';
import Link from 'next/link';
import { getRun } from '@/lib/foundry-store';

export const metadata: Metadata = {
  title: 'Foundry Run',
  description: 'Foundry run item results and status.',
};

export default async function FoundryRunPage({ params }: { params: Promise<{ datasetRunId: string }> }) {
  const { datasetRunId } = await params;
  const run = getRun(datasetRunId);
  const items = Array.isArray(run?.item_results) ? (run.item_results as Array<Record<string, unknown>>) : [];

  function statusBadge(status: string) {
    const s = status?.toLowerCase();
    if (s === 'pass' || s === 'passed') return 'bg-success/10 text-success border-success/20';
    if (s === 'fail' || s === 'failed' || s === 'error') return 'bg-destructive/10 text-destructive border-destructive/20';
    return 'bg-surface-elevated text-muted border-border';
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted mb-1">
        <Link href="/intelligence/foundry" className="text-accent hover:underline">Foundry</Link>
        <span>/</span>
        <span className="text-foreground font-mono text-xs">{datasetRunId}</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
          Run {datasetRunId}
        </h1>
        <p className="text-muted text-sm mt-1">Item results for this foundry run.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <table className="stitch-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Status</th>
              <th>Trace</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <svg className="h-8 w-8 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm text-muted">No item results for this run.</p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const status = String(item.status ?? '—');
                return (
                  <tr key={String(item.item_id)}>
                    <td className="font-mono text-xs text-foreground">{String(item.item_id)}</td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadge(status)}`}>
                        {status}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-muted">{String(item.trace_id ?? '—')}</td>
                    <td className="text-sm text-muted">{String(item.details ?? '—')}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
