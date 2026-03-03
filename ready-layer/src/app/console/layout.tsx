/**
 * Console Layout - Shared layout for all console pages
 * 
 * Provides:
 * - Consistent navigation sidebar
 * - Dark/light mode support
 * - Main content area with proper spacing
 */

import { ReactNode } from 'react';
import { ConsoleNavigation } from '@/components/ConsoleNavigation';

export const metadata = {
  title: 'Requiem Console',
  description: 'Provable AI Runtime Control Plane',
};

interface ConsoleLayoutProps {
  children: ReactNode;
}

export default function ConsoleLayout({ children }: ConsoleLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <ConsoleNavigation />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
