import { loadCalibrationReport } from '@/lib/calibration-report';

export const dynamic = 'force-dynamic';

export default async function CalibrationClaimPage({ params }: { params: Promise<{ claim_type: string }> }) {
  const claim = (await params).claim_type.toUpperCase();
  const rows = loadCalibrationReport().filter((r) => r.claim_type === claim);

  if (rows.length === 0) {
    return <div className="p-6">Insufficient data (n &lt; threshold)</div>;
  }

  const row = rows[0];

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Calibration Drilldown: {claim}</h1>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">bin_range</th>
            <th className="text-left py-2">count</th>
            <th className="text-left py-2">avg_p</th>
            <th className="text-left py-2">empirical_freq</th>
            <th className="text-left py-2">gap</th>
          </tr>
        </thead>
        <tbody>
          {row.bins.map((bin) => (
            <tr key={bin.bin_index} className="border-b">
              <td className="py-2">[{bin.bin_start.toFixed(1)}, {bin.bin_end.toFixed(1)})</td>
              <td className="py-2">{bin.count}</td>
              <td className="py-2">{bin.avg_predicted_p.toFixed(4)}</td>
              <td className="py-2">{bin.empirical_frequency.toFixed(4)}</td>
              <td className="py-2">{bin.gap.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
