import Link from 'next/link';
import { listDatasets, listRuns } from '@/lib/foundry-store';

export default function FoundryPage() {
  const datasets = listDatasets();
  const runs = listRuns();
  const lastRunByDataset = new Map(runs.map(run => [String(run.dataset_id), run]));

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold">Test Data Foundry</h1>
      <p className="mt-2 text-sm text-gray-500">Deterministic datasets and recent execution status.</p>
      <table className="mt-6 min-w-full border text-sm">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="border p-2">Dataset</th>
            <th className="border p-2">Type</th>
            <th className="border p-2">Items</th>
            <th className="border p-2">Last run</th>
          </tr>
        </thead>
        <tbody>
          {datasets.map(dataset => {
            const run = lastRunByDataset.get(String(dataset.dataset_id));
            return (
              <tr key={String(dataset.dataset_id)}>
                <td className="border p-2"><Link className="text-blue-600 underline" href={`/intelligence/foundry/${String(dataset.dataset_id)}`}>{String(dataset.name)}</Link></td>
                <td className="border p-2">{String(dataset.dataset_type)}</td>
                <td className="border p-2">{String(dataset.items_count)}</td>
                <td className="border p-2">{run ? String((run as Record<string, unknown>).started_at) : 'Never'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
