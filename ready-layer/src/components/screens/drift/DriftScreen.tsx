'use client';

import Link from 'next/link';
import { EmptyState, PageHeader } from '@/components/ui';

export function DriftScreen() {
  return (
    <div className="mx-auto max-w-7xl p-6">
      <PageHeader title="Drift" description="Vector drift and fingerprint variance across replay windows." />
      <EmptyState
        title="No drift vectors yet"
        description="Drift vectors appear when replay comparisons detect fingerprint divergence."
        action={<Link href="/runs" className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500">Open Runs</Link>}
      />
    </div>
  );
}
