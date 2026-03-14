/**
 * Console Layout - Shared layout for all console pages
 *
 * Provides consistent navigation sidebar, theme support, and proper spacing.
 */

import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { ConsoleNavigation } from '@/components/ConsoleNavigation';

export const metadata: Metadata = {
  title: {
    default: 'Console',
    template: '%s | Requiem Console',
  },
  description: 'Provable AI Runtime Control Plane — manage runs, policies, capabilities, and drift.',
  robots: { index: false, follow: false },
};

interface ConsoleLayoutProps {
  children: ReactNode;
}

export default function ConsoleLayout({ children }: ConsoleLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex">
      <ConsoleNavigation />
      <main className="flex-1 overflow-auto" id="console-main">
        {children}
      </main>
    </div>
  );
}
