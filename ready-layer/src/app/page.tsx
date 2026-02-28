// ready-layer/src/app/page.tsx
//
// Root page — redirects to the main app dashboard.
// Auth guard is handled by middleware (src/middleware.ts).
// INVARIANT: No direct engine calls. No sensitive data rendered here.

import { redirect } from 'next/navigation';

export default function RootPage() {
  // Redirect authenticated users to the executions dashboard.
  // Unauthenticated users are handled by middleware → /login.
  redirect('/app/executions');
}
