'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { RouteTruthStateCard } from './RouteTruthStateCard';
import { classifyProtectedRouteTruth } from '@/lib/protected-route-truth';

export function ProtectedRouteTruthCard() {
  const pathname = usePathname() ?? '/';
  const backendConfigured = Boolean(process.env.NEXT_PUBLIC_REQUIEM_API_URL);

  const routeTruth = useMemo(() => classifyProtectedRouteTruth(pathname, backendConfigured), [pathname, backendConfigured]);

  return (
    <div className="mx-6 mt-3">
      <RouteTruthStateCard
        stateLabel={routeTruth.stateLabel}
        title={routeTruth.title}
        detail={routeTruth.detail}
        nextStep={routeTruth.nextStep}
        tone={routeTruth.tone}
      />
    </div>
  );
}
