import type { ReactNode } from 'react';
import { OperationalTruthBanner } from './OperationalTruthBanner';

interface ProtectedRouteShellProps {
  children: ReactNode;
}

export function ProtectedRouteShell({ children }: ProtectedRouteShellProps) {
  return (
    <main className="min-h-screen bg-background" id="protected-main">
      <OperationalTruthBanner />
      {children}
    </main>
  );
}
