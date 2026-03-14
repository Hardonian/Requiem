'use client';

/**
 * StitchContainer - Main content wrapper using design tokens
 */

import { ReactNode } from 'react';

interface StitchContainerProps {
  children?: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full';
  centered?: boolean;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full',
};

export function StitchContainer({
  children,
  className = '',
  maxWidth = 'md',
  centered = true,
}: StitchContainerProps) {
  return (
    <div className={`
      flex-1 w-full
      ${centered ? 'mx-auto' : ''}
      ${maxWidthClasses[maxWidth]}
      p-6 lg:p-8 pb-24
      ${className}
    `}>
      {children}
    </div>
  );
}
