import Link from 'next/link';
import { getDataset, listRuns } from '@/lib/foundry-store';

export default async function DatasetPage({ params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const dataset = getDataset(datasetId);
  const runs = listRuns(datasetId);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold">Dataset {dataset ? String(dataset.name) : datasetId}</h1>
      <p className="mt-2 text-sm text-gray-500">Recent runs and pass/fail breakdown.</p>
      <table className="mt-6 min-w-full border text-sm">
        <thead><tr className="bg-gray-50"><th className="border p-2">Run</th><th className="border p-2">Started</th><th className="border p-2">Pass</th><th className="border p-2">Fail</th></tr></thead>
        <tbody>
          {runs.map(run => {
            const summary = (run.summary ?? {}) as Record<string, unknown>;
            return <tr key={String(run.dataset_run_id)}>
              <td className="border p-2"><Link className="text-blue-600 underline" href={`/intelligence/foundry/runs/${String(run.dataset_run_id)}`}>{String(run.dataset_run_id)}</Link></td>
              <td className="border p-2">{String(run.started_at)}</td>
              <td className="border p-2">{String(summary.pass_count ?? 0)}</td>
              <td className="border p-2">{String(summary.fail_count ?? 0)}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </main>
  );
}
