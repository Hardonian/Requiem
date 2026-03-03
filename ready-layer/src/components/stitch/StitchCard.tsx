'use client';

/**
 * StitchCard - Consistent card component with Stitch styling
 * 
 * Features:
 * - Dark surface background
 * - Border styling
 * - Optional hover states
 * - Clickable variant with cursor pointer
 */

import { ReactNode } from 'react';

interface StitchCardProps {
  children: ReactNode;
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
        bg-[#1c252e] border border-[#2a3441] rounded-xl
        ${paddingClasses[padding]}
        ${hoverable ? 'hover:bg-[#151e27] transition-all cursor-pointer' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}
