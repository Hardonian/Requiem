import React from 'react';

export interface ArtifactLineageItem {
  hash: string;
  parent?: string;
  kind: string;
}

export function ArtifactLineage({ items }: { items: ArtifactLineageItem[] }): JSX.Element {
  return (
    <section aria-label="Artifact Lineage" className="rounded-md border border-slate-300 p-4">
      <h3 className="mb-2 text-sm font-semibold">Artifact Lineage</h3>
      <ul className="space-y-2 text-xs">
        {items.map((item) => (
          <li key={item.hash} className="rounded border border-slate-200 p-2">
            <div><strong>hash:</strong> {item.hash}</div>
            <div><strong>kind:</strong> {item.kind}</div>
            <div><strong>parent:</strong> {item.parent ?? 'root'}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
