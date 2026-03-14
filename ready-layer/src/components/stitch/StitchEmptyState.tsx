'use client';

/**
 * StitchEmptyState - Canonical empty state using design tokens
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
    <div className={`text-center py-16 px-6 bg-surface rounded-xl border border-border ${className}`}>
      {icon && (
        <div className="mx-auto h-12 w-12 text-muted mb-4 flex items-center justify-center">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-muted max-w-sm mx-auto leading-relaxed">
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
