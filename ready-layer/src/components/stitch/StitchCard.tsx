'use client';

/**
 * StitchCard - Consistent card component using design tokens
 */

import { ReactNode } from 'react';

interface StitchCardProps {
  key?: string;
  children?: ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function StitchCard({
  children,
  className = '',
  hoverable = false,
  onClick,
  padding = 'md'
}: StitchCardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  return (
    <div
      className={`
        bg-surface border border-border rounded-xl
        shadow-sm
        ${paddingClasses[padding]}
        ${hoverable ? 'hover:shadow-md hover:border-border/80 transition-all duration-200' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}
