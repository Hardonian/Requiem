import React from 'react';
import { getCases } from '@/lib/intelligence-store';

interface Props {
  searchParams: Promise<{ tenant?: string }>;
}

function pointerType(pointer: string): 'run' | 'artifact' | 'evidence' {
  if (pointer.startsWith('run:')) return 'run';
  if (pointer.startsWith('artifact:') || pointer.startsWith('artifact://')) return 'artifact';
  return 'evidence';
}

function pointerBadgeClass(type: 'run' | 'artifact' | 'evidence'): string {
  if (type === 'run') return 'bg-blue-100 text-blue-800';
  if (type === 'artifact') return 'bg-emerald-100 text-emerald-800';
  return 'bg-amber-100 text-amber-800';
}

export default async function CasesPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenantId = params.tenant ?? 'public';
  const rows = getCases(tenantId);

  return (
    <main className="p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Intelligence / Cases</h1>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Case</th>
            <th className="text-left py-2">Summary</th>
            <th className="text-left py-2">Command</th>
            <th className="text-left py-2">Cost Units</th>
            <th className="text-left py-2">Artifact Pointers</th>
            <th className="text-left py-2">Tests</th>
            <th className="text-left py-2">Build</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.case_id} className="border-b align-top">
              <td className="py-2 font-mono">{row.case_id.slice(0, 8)}</td>
              <td className="py-2">{row.summary}</td>
              <td className="py-2">{row.failing_command}</td>
              <td className="py-2">{row.cost_units}</td>
              <td className="py-2">
                <div className="space-y-1">
                  {(row.pointers ?? []).slice(0, 3).map((pointer) => {
                    const type = pointerType(pointer);
                    return (
                      <div key={pointer} className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${pointerBadgeClass(type)}`}>
                          {type}
                        </span>
                        <span className="font-mono text-xs text-slate-600 truncate max-w-[260px]">{pointer}</span>
                      </div>
                    );
                  })}
                  {(row.pointers ?? []).length === 0 && <span className="text-slate-400 text-xs">none</span>}
                  {(row.pointers ?? []).length > 3 && <span className="text-xs text-slate-500">+{(row.pointers ?? []).length - 3} more</span>}
                </div>
              </td>
              <td className="py-2">{String(row.tests_passed)}</td>
              <td className="py-2">{String(row.build_passed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
