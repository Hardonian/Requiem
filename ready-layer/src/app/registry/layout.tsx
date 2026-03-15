import type { ReactNode } from 'react';
import { ProtectedRouteShell } from '@/components/ui';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <ProtectedRouteShell>{children}</ProtectedRouteShell>;
}
