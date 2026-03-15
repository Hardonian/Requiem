import type { Metadata } from 'next';
import Link from 'next/link';
import { listDatasets, listRuns } from '@/lib/foundry-store';

export const metadata: Metadata = {
  title: 'Foundry',
  description: 'Test vector datasets and deterministic execution history.',
};

export default function FoundryPage() {
  const datasets = listDatasets();
  const runs = listRuns();
  const lastRunByDataset = new Map(runs.map((run) => [String(run.dataset_id), run]));

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Foundry</h1>
          <p className="text-muted text-sm mt-1">
            Deterministic test vector datasets and recent execution status.
          </p>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="stitch-section-header">
          <h2 className="stitch-section-title">Datasets</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="stitch-table">
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Type</th>
                <th className="text-right">Items</th>
                <th>Last Run</th>
              </tr>
            </thead>
            <tbody>
              {datasets.length === 0 ? (
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
                          d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                        />
                      </svg>
                      <p className="text-sm font-semibold text-foreground mb-1">No datasets found</p>
                      <p className="text-sm text-muted">
                        Datasets are loaded from the Foundry store. Set{' '}
                        <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono">
                          REQUIEM_FOUNDRY_DIR
                        </code>{' '}
                        to load stored datasets.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                datasets.map((dataset) => {
                  const run = lastRunByDataset.get(String(dataset.dataset_id));
                  return (
                    <tr key={String(dataset.dataset_id)}>
                      <td>
                        <Link
                          href={`/intelligence/foundry/${String(dataset.dataset_id)}`}
                          className="text-accent hover:underline font-medium"
                        >
                          {String(dataset.name)}
                        </Link>
                      </td>
                      <td className="font-mono text-xs text-muted">{String(dataset.dataset_type)}</td>
                      <td className="text-right font-mono">{String(dataset.items_count)}</td>
                      <td className="text-muted">
                        {run ? String((run as Record<string, unknown>).started_at) : (
                          <span className="text-muted/50">Never</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
