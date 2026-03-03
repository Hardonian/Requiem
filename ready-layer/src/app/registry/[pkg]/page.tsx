import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Registry Package',
  description: 'Registry package digest details.',
};

export default async function RegistryPkgPage({ params }: { params: Promise<{ pkg: string }> }) {
  const { pkg } = await params;
  return (
    <div className="mx-auto max-w-4xl p-6">
      <PageHeader title={`Registry: ${pkg.slice(0, 16)}…`} description="Digest-level metadata for a registry object." />
      <EmptyState title="Package metadata unavailable" description="Registry details are available when object metadata indexing is enabled." />
    </div>
  );
}
