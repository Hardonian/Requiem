import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Request Demo | ReadyLayer',
  description: 'Book a ReadyLayer demo and share your deployment requirements.',
};

export default function EnterpriseRequestDemoPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <h1 className="text-3xl font-semibold">Request a ReadyLayer demo</h1>
      <p className="text-slate-600">
        We run demos from the same OSS runtime and control-plane flows shown in this repository.
        Share your use case, scale requirements, and compliance expectations, and we&apos;ll route you
        to the right operator.
      </p>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        <p className="font-medium text-slate-900">How to proceed</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Start with the support form for scheduling and discovery.</li>
          <li>Include tenant count, expected run volume, and residency constraints.</li>
          <li>Attach architecture questions so we can map the demo to your stack.</li>
        </ul>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/support/contact" className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
          Contact support
        </Link>
        <Link href="/pricing" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Back to pricing
        </Link>
      </div>
    </main>
  );
}
