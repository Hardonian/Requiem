'use client';

/**
 * StitchContainer - Main content wrapper for Stitch-styled pages
 * 
 * Features:
 * - Full-height flex container
 * - Dark background
 * - Centered content with max-width
 * - Proper padding for mobile
 */

import { ReactNode } from 'react';

interface StitchContainerProps {
  children?: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  centered?: boolean;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full',
};

export function StitchContainer({ 
  children, 
  className = '',
  maxWidth = 'md',
  centered = true,
}: StitchContainerProps) {
  return (
    <main className={`
      flex-1 w-full 
      ${centered ? 'mx-auto' : ''}
      ${maxWidthClasses[maxWidth]}
      p-4 pb-24
      ${className}
    `}>
      {children}
    </main>
  );
}
