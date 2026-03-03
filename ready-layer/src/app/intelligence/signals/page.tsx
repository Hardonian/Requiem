import { getSignals } from '@/lib/intelligence-store';

interface Props {
  searchParams: Promise<{ tenant?: string; severity?: 'INFO' | 'WARN' | 'CRITICAL' }>;
}

export default async function SignalsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenantId = params.tenant ?? 'public';
  const rows = getSignals(tenantId, params.severity);

  return (
    <main className="p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Intelligence / Signals</h1>
      <table className="w-full text-sm border-collapse">
        <thead><tr className="border-b"><th className="text-left py-2">Type</th><th className="text-left py-2">Subject</th><th className="text-left py-2">Severity</th><th className="text-left py-2">Timestamp</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.signal_id} className="border-b"><td className="py-2">{row.signal_type}</td><td className="py-2">{row.subject}</td><td className="py-2">{row.severity}</td><td className="py-2">{row.timestamp}</td></tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
