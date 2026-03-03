import { getRun } from '@/lib/foundry-store';

export default async function FoundryRunPage({ params }: { params: Promise<{ datasetRunId: string }> }) {
  const { datasetRunId } = await params;
  const run = getRun(datasetRunId);
  const items = Array.isArray(run?.item_results) ? (run.item_results as Array<Record<string, unknown>>) : [];

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold">Foundry Run {datasetRunId}</h1>
      <table className="mt-6 min-w-full border text-sm">
        <thead><tr className="bg-gray-50"><th className="border p-2">Item</th><th className="border p-2">Status</th><th className="border p-2">Trace</th><th className="border p-2">Details</th></tr></thead>
        <tbody>
          {items.map(item => <tr key={String(item.item_id)}>
            <td className="border p-2">{String(item.item_id)}</td>
            <td className="border p-2">{String(item.status)}</td>
            <td className="border p-2">{String(item.trace_id)}</td>
            <td className="border p-2">{String(item.details)}</td>
          </tr>)}
        </tbody>
      </table>
    </main>
  );
}
