'use client';

/**
 * StitchFeatureCard - Feature highlight card using design tokens
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
        group bg-surface hover:bg-surface-elevated border border-border
        rounded-xl p-4 transition-all duration-200 shadow-sm hover:shadow-md
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-lg ${iconBgClass} flex items-center justify-center ${iconColorClass} shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-foreground font-bold font-display text-base mb-1">{title}</h4>
          <p className="text-muted text-xs leading-relaxed">{description}</p>
        </div>
        {onClick && (
          <svg
            className="h-5 w-5 text-border group-hover:text-accent transition-colors flex-shrink-0 mt-1"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        )}
      </div>
    </div>
  );
}
