'use client';

/**
 * StitchFeatureCard - Feature highlight card with icon, title, and description
 * 
 * Features:
 * - Icon with colored background
 * - Title and description
 * - Chevron right indicator for navigation
 * - Hover state
 */

import { ReactNode } from 'react';

interface StitchFeatureCardProps {
  key?: string;
  title: string;
  description: string;
  icon: ReactNode;
  iconBgClass?: string;
  iconColorClass?: string;
  onClick?: () => void;
  className?: string;
}

export function StitchFeatureCard({
  title,
  description,
  icon,
  iconBgClass = 'bg-purple-500/10',
  iconColorClass = 'text-purple-400',
  onClick,
  className = '',
}: StitchFeatureCardProps) {
  return (
    <div 
      className={`
        group bg-[#1c252e] hover:bg-[#151e27] border border-[#2a3441] 
        rounded-xl p-4 transition-all cursor-pointer
        ${className}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-lg ${iconBgClass} flex items-center justify-center ${iconColorClass} shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-bold font-display text-base mb-1">{title}</h4>
          <p className="text-[#94a3b8] text-xs leading-relaxed">{description}</p>
        </div>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-5 w-5 text-[#2a3441] group-hover:text-[#137fec] transition-colors flex-shrink-0 mt-1" 
          viewBox="0 0 24 24" 
          fill="currentColor"
        >
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
        </svg>
      </div>
    </div>
  );
}
