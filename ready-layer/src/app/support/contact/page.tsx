import type { Metadata } from 'next';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Contact | Requiem Support',
  description: 'Contact Requiem support for incident response, product questions, or enterprise inquiries.',
};

const contactChannels = [
  { label: 'Support', value: 'support@readylayer.com' },
  { label: 'Sales', value: 'sales@readylayer.com' },
  { label: 'General', value: 'hello@readylayer.com' },
];

export default function ContactPage() {
  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Contact</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Talk to the Requiem team.</h1>
        <p className="mt-4 text-slate-600">
          Share incident context, deployment questions, or purchase requirements. Include trace IDs and relevant route details for fastest triage.
        </p>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <ul className="space-y-4">
            {contactChannels.map((item) => (
              <li key={item.label} className="flex flex-col gap-1 border-b border-slate-100 pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                <a href={`mailto:${item.value}`} className="text-sm text-emerald-700 hover:underline">
                  {item.value}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </MarketingShell>
  );
}
