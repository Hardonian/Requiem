'use client';

/**
 * StitchBadge - Status badge with consistent token usage
 */

import type { ReactNode } from 'react';

interface StitchBadgeProps {
  children?: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error';
  pulse?: boolean;
  className?: string;
}

export function StitchBadge({
  children,
  variant = 'default',
  pulse = false,
  className = ''
}: StitchBadgeProps) {
  const variantClasses = {
    default: 'bg-accent/10 border-accent/20 text-accent',
    success: 'bg-success/10 border-success/20 text-success',
    warning: 'bg-warning/10 border-warning/20 text-warning',
    error: 'bg-destructive/10 border-destructive/20 text-destructive',
  };

  return (
    <span className={`
      inline-flex items-center gap-1.5 rounded-full
      px-2.5 py-0.5 border text-xs font-medium
      ${variantClasses[variant]}
      ${className}
    `}>
      {pulse && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" aria-hidden="true" />
      )}
      {children}
    </span>
  );
}
