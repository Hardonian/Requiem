import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Changelog | ReadyLayer',
  description: 'Product and runtime release notes for ReadyLayer.',
};

export default function ChangelogPage() {
  return <main className="mx-auto max-w-3xl px-6 py-12"><h1 className="text-3xl font-semibold">Changelog</h1><p className="mt-4 text-slate-600">See repository CHANGELOG.md for the latest release notes and contract updates.</p></main>;
}
