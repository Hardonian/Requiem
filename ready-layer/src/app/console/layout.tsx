/**
 * Console Layout - Shared layout for all console pages
 */

import { ReactNode } from 'react';

export const metadata = {
  title: 'Requiem Console',
  description: 'Provable AI Runtime Control Plane',
};

interface ConsoleLayoutProps {
  children: ReactNode;
}

export default function ConsoleLayout({ children }: ConsoleLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {children}
    </div>
  );
}
