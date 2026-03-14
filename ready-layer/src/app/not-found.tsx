import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export default function NotFound() {
  return (
    <MarketingShell compact>
      <section className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">404</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">Page not found</h1>
        <p className="mt-3 max-w-xl text-slate-600">The route you requested is unavailable or has moved. Use one of the verified navigation paths below.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            Return home
          </Link>
          <Link href="/docs" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Open docs
          </Link>
          <Link href="/app/executions" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Go to dashboard
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
