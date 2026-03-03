'use client';

/**
 * StitchButton - Primary and secondary button variants
 * 
 * Variants:
 * - primary: Blue background, white text
 * - secondary: Dark surface, border, white text
 */

import { ReactNode } from 'react';

interface StitchButtonProps {
  children?: ReactNode;
  variant?: 'primary' | 'secondary';
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
    flex items-center justify-center gap-2 rounded-lg h-12 px-6 
    text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed
    ${fullWidth ? 'w-full' : ''}
  `;

  const variantClasses = {
    primary: 'bg-[#137fec] hover:bg-[#0b5cb5] text-white',
    secondary: 'bg-[#1c252e] border border-[#2a3441] hover:bg-[#151e27] text-white',
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
