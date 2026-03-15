import type { Metadata } from 'next';
import Link from 'next/link';
import { getDataset, listRuns } from '@/lib/foundry-store';

export const metadata: Metadata = {
  title: 'Foundry Dataset',
  description: 'Foundry dataset runs and pass/fail breakdown.',
};

export default async function DatasetPage({ params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const dataset = getDataset(datasetId);
  const runs = listRuns(datasetId);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted mb-1">
        <Link href="/intelligence/foundry" className="text-accent hover:underline">Foundry</Link>
        <span>/</span>
        <span className="text-foreground">{dataset ? String(dataset.name) : datasetId}</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
          {dataset ? String(dataset.name) : datasetId}
        </h1>
        <p className="text-muted text-sm mt-1">Recent runs and pass/fail breakdown.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <table className="stitch-table">
          <thead>
            <tr>
              <th>Run ID</th>
              <th>Started</th>
              <th>Pass</th>
              <th>Fail</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <svg className="h-8 w-8 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm text-muted">No runs found for this dataset.</p>
                  </div>
                </td>
              </tr>
            ) : (
              runs.map((run) => {
                const summary = (run.summary ?? {}) as Record<string, unknown>;
                const runId = String(run.dataset_run_id);
                return (
                  <tr key={runId}>
                    <td>
                      <Link className="text-accent hover:underline font-mono text-xs" href={`/intelligence/foundry/runs/${runId}`}>
                        {runId}
                      </Link>
                    </td>
                    <td className="text-muted">{String(run.started_at)}</td>
                    <td>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-success/10 text-success border border-success/20">
                        {String(summary.pass_count ?? 0)}
                      </span>
                    </td>
                    <td>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                        {String(summary.fail_count ?? 0)}
                      </span>
                    </td>
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
