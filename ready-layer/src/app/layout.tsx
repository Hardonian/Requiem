// ready-layer/src/app/layout.tsx
//
// Root layout — required by Next.js App Router.
// Sets global metadata, fonts, and CSS.
// INVARIANT: No direct engine calls here. Auth checked in middleware.

import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme/ThemeProvider';

export const metadata: Metadata = {
  title: {
    default: 'Requiem — Deterministic Agent Compute. Verifiable by Design.',
    template: '%s | Requiem',
  },
  description:
    'Run AI workflows with cryptographic receipts, capability enforcement, and replayable execution — not best-effort logs. Deterministic by design.',
  keywords: ['AI', 'Deterministic', 'Runtime', 'Replay', 'BLAKE3', 'Governance'],
  authors: [{ name: 'Hardonian Team' }],
  creator: 'Hardonian',
  publisher: 'Hardonian',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://requiem.hardonian.com'),
  openGraph: {
    title: 'Requiem — Deterministic Agent Compute',
    description: 'Run AI workflows with cryptographic receipts and replayable execution. Verifiable by design.',
    url: 'https://requiem.hardonian.com',
    siteName: 'Requiem',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Requiem — Deterministic Agent Compute',
    description: 'Run AI workflows with cryptographic receipts and replayable execution. Verifiable by design.',
    creator: '@hardonian',
    site: '@hardonian',
  },
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="antialiased">
      <body className="min-h-screen bg-background text-foreground font-sans selection:bg-blue-100 selection:text-blue-900">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              'name': 'Requiem',
              'operatingSystem': 'Linux, Windows, macOS',
              'applicationCategory': 'DeveloperApplication',
              'description': 'Provable AI Runtime for deterministic agent execution.',
              'offers': {
                '@type': 'Offer',
                'price': '0',
                'priceCurrency': 'USD',
              },
            }),
          }}
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
