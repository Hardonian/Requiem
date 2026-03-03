'use client';

/**
 * Console Decisions Page - DEPRECATED
 * 
 * This page has been consolidated into the Policies page.
 * Policy decisions are now viewable in the &quot;Recent Decisions&quot; tab.
 * 
 * @deprecated Use /console/policies instead
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ConsoleDecisionsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to policies page with decisions tab
    router.replace('/console/policies?tab=decisions');
  }, [router]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Redirecting to Policies...</p>
          <p className="text-sm text-gray-400 mt-2">
            Decisions have been consolidated into the Policies page.
          </p>
        </div>
      </div>
    </div>
  );
}
