'use client';

/**
 * StitchActivityItem - Activity log item using design tokens
 */

import { ReactNode } from 'react';

interface StitchActivityItemProps {
  key?: string;
  title: string;
  description: string;
  timestamp: string;
  icon: ReactNode;
  iconBgClass?: string;
  iconColorClass?: string;
  className?: string;
  last?: boolean;
}

export function StitchActivityItem({
  title,
  description,
  timestamp,
  icon,
  iconBgClass = 'bg-success/10',
  iconColorClass = 'text-success',
  className = '',
  last = false,
}: StitchActivityItemProps) {
  return (
    <div className={`p-3 flex items-center gap-3 ${!last ? 'border-b border-border' : ''} ${className}`}>
      <div className={`w-8 h-8 rounded-full ${iconBgClass} flex items-center justify-center flex-shrink-0`}>
        <span className={iconColorClass}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{title}</div>
        <div className="text-xs text-muted truncate">{description}</div>
      </div>
      <time className="text-xs text-muted flex-shrink-0">{timestamp}</time>
    </div>
  );
}
