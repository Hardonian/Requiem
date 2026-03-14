'use client';

/**
 * StitchButton - Primary and secondary button variants using design tokens
 */

import { ReactNode } from 'react';

interface StitchButtonProps {
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: ReactNode;
  onClick?: () => void;
  className?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export function StitchButton({
  children,
  variant = 'primary',
  icon,
  onClick,
  className = '',
  fullWidth = false,
  disabled = false,
  type = 'button',
}: StitchButtonProps) {
  const baseClasses = `
    inline-flex items-center justify-center gap-2 rounded-lg h-10 px-5
    text-sm font-semibold transition-all duration-150
    disabled:opacity-50 disabled:cursor-not-allowed
    focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
    ${fullWidth ? 'w-full' : ''}
  `;

  const variantClasses = {
    primary: 'bg-accent hover:brightness-110 text-white',
    secondary: 'bg-surface border border-border hover:bg-surface-elevated text-foreground',
    ghost: 'bg-transparent hover:bg-surface-elevated text-foreground',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
