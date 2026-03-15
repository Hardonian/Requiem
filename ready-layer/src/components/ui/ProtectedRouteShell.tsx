import type { ReactNode } from 'react';
import { OperationalTruthBanner } from './OperationalTruthBanner';
import { ProtectedRouteTruthCard } from './ProtectedRouteTruthCard';

interface ProtectedRouteShellProps {
  children: ReactNode;
}

export function ProtectedRouteShell({ children }: ProtectedRouteShellProps) {
  return (
    <main className="min-h-screen bg-background" id="protected-main">
      <OperationalTruthBanner />
      <ProtectedRouteTruthCard />
      {children}
    </main>
  );
}
