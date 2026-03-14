import type { Metadata } from 'next';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Requiem handles tenant-scoped telemetry, receipts, and personal data.',
};

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <h1 className="text-3xl font-bold text-foreground font-display tracking-tight">Privacy Policy</h1>
        <p className="mt-4 text-muted leading-relaxed">
          ReadyLayer processes tenant-scoped telemetry and receipts for deterministic verification.
          Personal data handling follows the repository privacy policy.
        </p>
        <p className="mt-4 text-muted leading-relaxed">
          All execution data is scoped to your tenant boundary. Cryptographic receipts contain
          only hashes — no raw inputs or outputs are stored unless explicitly configured.
        </p>
      </article>
    </MarketingShell>
  );
}
