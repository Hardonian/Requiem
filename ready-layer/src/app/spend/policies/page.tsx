import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Spend Policies',
  description: 'Policy controls for spend governance.',
};

export default function SpendPoliciesPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <PageHeader title="Spend Policies" description="Enforce policy and budget controls for execution units." />
      <EmptyState
        title="Configure policy controls"
        description="Use the policy console to configure guardrails and enforcement actions."
        action={<Link href="/console/policies" className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500">Open Policy Console</Link>}
      />
    </div>
  );
}
