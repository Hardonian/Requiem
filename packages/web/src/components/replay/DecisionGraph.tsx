import React from 'react';

export interface DecisionGraphData {
  nodes: Array<{ id: string; label?: string; type?: string }>;
  edges: Array<{ from: string; to: string; relation?: string }>;
}

export function DecisionGraph({ graph }: { graph: DecisionGraphData }): JSX.Element {
  return (
    <section aria-label="Decision Graph" className="rounded-md border border-slate-300 p-4">
      <h3 className="mb-2 text-sm font-semibold">Decision Graph</h3>
      <pre className="max-h-64 overflow-auto text-xs">{JSON.stringify(graph, null, 2)}</pre>
    </section>
  );
}
