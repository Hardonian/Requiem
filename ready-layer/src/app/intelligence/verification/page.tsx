import { getPredictions, getOutcomes } from '@/lib/intelligence-store';

interface Props {
  searchParams: Promise<{ tenant?: string; run_id?: string }>;
}

export default async function VerificationPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenantId = params.tenant ?? 'public';
  const predictions = getPredictions(tenantId, params.run_id);
  const outcomes = getOutcomes(tenantId, params.run_id);

  return (
    <main className="p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Intelligence / Verification</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded p-4"><p className="text-xs text-slate-500">Predictions</p><p className="text-2xl font-semibold">{predictions.length}</p></div>
        <div className="border rounded p-4"><p className="text-xs text-slate-500">Outcomes</p><p className="text-2xl font-semibold">{outcomes.length}</p></div>
        <div className="border rounded p-4"><p className="text-xs text-slate-500">Avg Brier</p><p className="text-2xl font-semibold">{(outcomes.reduce((s, o) => s + o.brier_score, 0) / Math.max(outcomes.length, 1)).toFixed(4)}</p></div>
      </div>
    </main>
  );
}
