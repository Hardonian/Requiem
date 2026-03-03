import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Drift Vector',
  description: 'Detailed drift vector diagnostics.',
};

export default async function DriftVectorPage({ params }: { params: Promise<{ vector: string }> }) {
  const { vector } = await params;
  return (
    <div className="mx-auto max-w-4xl p-6">
      <PageHeader title={`Drift Vector ${vector}`} description="Inspect vector-level drift and replay variance." />
      <EmptyState title="No vector data found" description="This vector is not indexed yet. Run replay diagnostics to generate drift evidence." />
    </div>
  );
}
