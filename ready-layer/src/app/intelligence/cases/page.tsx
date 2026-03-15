import type { Metadata } from 'next';
import React from 'react';
import { getCases } from '@/lib/intelligence-store';

export const metadata: Metadata = {
  title: 'Cases',
  description: 'Intelligence case records with artifact pointers and execution evidence.',
};

interface Props {
  searchParams: Promise<{ tenant?: string }>;
}

function pointerType(pointer: string): 'run' | 'artifact' | 'evidence' {
  if (pointer.startsWith('run:')) return 'run';
  if (pointer.startsWith('artifact:') || pointer.startsWith('artifact://')) return 'artifact';
  return 'evidence';
}

const pointerBadgeStyles: Record<string, string> = {
  run: 'bg-accent/10 text-accent border border-accent/20',
  artifact: 'bg-success/10 text-success border border-success/20',
  evidence: 'bg-warning/10 text-warning border border-warning/20',
};

export default async function CasesPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenantId = params.tenant ?? 'public';
  const rows = getCases(tenantId);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Cases</h1>
          <p className="text-muted text-sm mt-1">
            Intelligence case records with artifact pointers and execution evidence.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-elevated border border-border rounded-full text-xs font-medium text-muted">
          Tenant: <span className="font-mono ml-1">{tenantId}</span>
        </span>
      </div>

      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="stitch-section-header">
          <h2 className="stitch-section-title">Case Records</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="stitch-table">
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Summary</th>
                <th>Command</th>
                <th className="text-right">Cost</th>
                <th>Pointers</th>
                <th>Tests</th>
                <th>Build</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
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
                          d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                      <p className="text-sm font-semibold text-foreground mb-1">No cases recorded</p>
                      <p className="text-sm text-muted">
                        Cases are created by the intelligence pipeline. Set{' '}
                        <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono">
                          REQUIEM_INTELLIGENCE_STORE_DIR
                        </code>{' '}
                        to load stored data.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.case_id} className="align-top">
                    <td className="font-mono text-xs">{row.case_id.slice(0, 8)}&hellip;</td>
                    <td className="max-w-[200px] truncate">{row.summary}</td>
                    <td className="font-mono text-xs text-muted max-w-[140px] truncate">
                      {row.failing_command}
                    </td>
                    <td className="text-right font-mono">{row.cost_units}</td>
                    <td>
                      <div className="space-y-1">
                        {(row.pointers ?? []).slice(0, 3).map((pointer) => {
                          const type = pointerType(pointer);
                          return (
                            <div key={pointer} className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${pointerBadgeStyles[type]}`}
                              >
                                {type}
                              </span>
                              <span className="font-mono text-xs text-muted truncate max-w-[180px]">
                                {pointer}
                              </span>
                            </div>
                          );
                        })}
                        {(row.pointers ?? []).length === 0 && (
                          <span className="text-muted text-xs">none</span>
                        )}
                        {(row.pointers ?? []).length > 3 && (
                          <span className="text-xs text-muted">
                            +{(row.pointers ?? []).length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${row.tests_passed ? 'bg-success/10 text-success border border-success/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}
                      >
                        {String(row.tests_passed)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${row.build_passed ? 'bg-success/10 text-success border border-success/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}
                      >
                        {String(row.build_passed)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
