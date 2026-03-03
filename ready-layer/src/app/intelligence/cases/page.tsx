import { getCases } from '@/lib/intelligence-store';

interface Props {
  searchParams: Promise<{ tenant?: string }>;
}

export default async function CasesPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenantId = params.tenant ?? 'public';
  const rows = getCases(tenantId);

  return (
    <main className="p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Intelligence / Cases</h1>
      <table className="w-full text-sm border-collapse">
        <thead><tr className="border-b"><th className="text-left py-2">Case</th><th className="text-left py-2">Summary</th><th className="text-left py-2">Command</th><th className="text-left py-2">Tests</th><th className="text-left py-2">Build</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.case_id} className="border-b"><td className="py-2 font-mono">{row.case_id.slice(0, 8)}</td><td className="py-2">{row.summary}</td><td className="py-2">{row.failing_command}</td><td className="py-2">{String(row.tests_passed)}</td><td className="py-2">{String(row.build_passed)}</td></tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
