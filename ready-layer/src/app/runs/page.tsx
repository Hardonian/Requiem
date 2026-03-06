import Link from 'next/link';

export default function RunsPage() {
  return <main className="mx-auto max-w-4xl px-6 py-12"><h1 className="text-3xl font-semibold">Runs</h1><p className="mt-4 text-slate-600">Track run receipts, policy outcomes, and replay checks.</p><Link href="/console/runs" className="mt-4 inline-block text-emerald-700 hover:underline">Open Console Runs</Link></main>;
}
