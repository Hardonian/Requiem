'use client';

/**
 * StitchActivityItem - Activity log item with icon, title, description, and timestamp
 * 
 * Features:
 * - Colored icon background
 * - Title and description
 * - Relative timestamp
 * - Border separator
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
  iconBgClass = 'bg-green-500/10',
  iconColorClass = 'text-green-500',
  className = '',
  last = false,
}: StitchActivityItemProps) {
  return (
    <div className={`p-3 flex items-center gap-3 ${!last ? 'border-b border-[#2a3441]' : ''} ${className}`}>
      <div className={`w-8 h-8 rounded-full ${iconBgClass} flex items-center justify-center flex-shrink-0`}>
        <span className={iconColorClass}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{title}</div>
        <div className="text-xs text-[#94a3b8] truncate">{description}</div>
      </div>
      <span className="text-xs text-[#94a3b8] flex-shrink-0">{timestamp}</span>
    </div>
  );
}
