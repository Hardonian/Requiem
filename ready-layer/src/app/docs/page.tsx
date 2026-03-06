import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Documentation | ReadyLayer',
  description: 'Guides for operating deterministic, replayable ReadyLayer workloads.',
};

const links = [
  { href: '/library', label: 'Library' },
  { href: '/support/status', label: 'Support Status' },
  { href: '/status', label: 'System Status' },
];

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
      <h1 className="text-3xl font-semibold">ReadyLayer Documentation</h1>
      <p className="text-slate-600">Documentation is versioned with the currently deployed prompt and engine surface. Use the links below for current operational references.</p>
      <ul className="list-disc space-y-2 pl-5">
        {links.map((link) => (
          <li key={link.href}>
            <Link className="text-emerald-700 hover:underline" href={link.href}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
