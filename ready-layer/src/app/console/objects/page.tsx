'use client';

/**
 * Console Objects Page - DEPRECATED
 * 
 * This page has been consolidated into the Logs page.
 * CAS objects are now viewable as part of the event log.
 * 
 * @deprecated Use /console/logs instead
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ConsoleObjectsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to logs page with objects filter
    router.replace('/console/logs?filter=objects');
  }, [router]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted">Redirecting to Logs...</p>
          <p className="text-sm text-muted mt-2">
            Objects have been consolidated into the event log.
          </p>
        </div>
      </div>
    </div>
  );
}
