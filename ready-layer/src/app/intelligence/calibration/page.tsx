import { getCalibration } from '@/lib/intelligence-store';

interface Props {
  searchParams: Promise<{ tenant?: string; claim_type?: string; window?: string }>;
}

export default async function CalibrationPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenantId = params.tenant ?? 'public';
  const rows = getCalibration(tenantId, params.claim_type, params.window);

  return (
    <main className="p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Intelligence / Calibration</h1>
      <p className="text-sm text-slate-600">Tenant: <span className="font-mono">{tenantId}</span></p>
      <p className="text-sm text-slate-600">Window: <span className="font-mono">{params.window ?? "all"}</span></p>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Claim</th>
            <th className="text-left py-2">Model</th>
            <th className="text-left py-2">Count</th>
            <th className="text-left py-2">Avg Brier</th>
            <th className="text-left py-2">Sharpness</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.claim_type}-${row.model_fingerprint}`} className="border-b">
              <td className="py-2">{row.claim_type}</td>
              <td className="py-2">{row.model_fingerprint}</td>
              <td className="py-2">{row.count}</td>
              <td className="py-2">{row.avg_brier.toFixed(4)}</td>
              <td className="py-2">{row.sharpness.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
