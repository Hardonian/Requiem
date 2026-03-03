'use client';

/**
 * StitchEmptyState - Empty state display with icon and action
 * 
 * Features:
 * - Centered layout
 * - Icon display
 * - Title and description
 * - Optional action button
 */

import { ReactNode } from 'react';

interface StitchEmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function StitchEmptyState({
  title,
  description,
  icon,
  action,
  className = '',
}: StitchEmptyStateProps) {
  return (
    <div className={`text-center py-12 bg-[#1c252e] rounded-xl border border-[#2a3441] ${className}`}>
      {icon && (
        <div className="mx-auto h-12 w-12 text-[#94a3b8] mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-medium text-white">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-[#94a3b8] max-w-sm mx-auto">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-6">
          {action}
        </div>
      )}
    </div>
  );
}
