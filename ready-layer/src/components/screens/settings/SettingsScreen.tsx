'use client';

import { EmptyState, PageHeader } from '@/components/ui';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export function SettingsScreen() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <PageHeader title="Settings" description="Manage tenant-level preferences, appearance, and account controls." />
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-sm font-semibold">Appearance</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Use one theme-aware UI across all console pages.</p>
        <div className="mt-3"><ThemeToggle /></div>
      </div>
      <EmptyState title="Account settings not configured" description="Tenant and account management is controlled by your identity provider." />
    </div>
  );
}
