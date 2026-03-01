// ready-layer/src/app/layout.tsx
//
// Root layout — required by Next.js App Router.
// Sets global metadata, fonts, and CSS.
// INVARIANT: No direct engine calls here. Auth checked in middleware.

import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Requiem — Provable AI Runtime',
    template: '%s | Requiem',
  },
  description:
    'Every AI decision provable. Every outcome replayable. Every policy enforced. The deterministic AI runtime with cryptographic execution proof.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
