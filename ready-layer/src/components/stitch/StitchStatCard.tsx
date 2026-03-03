'use client';

/**
 * StitchStatCard - Statistics display card with trend indicator
 * 
 * Features:
 * - Large numeric display
 * - Label
 * - Optional trend indicator (up/down with percentage)
 * - Color-coded trends
 */

interface StitchStatCardProps {
  key?: string;
  label: string;
  value: string | number;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
    label?: string;
  };
  className?: string;
}

export function StitchStatCard({ 
  label, 
  value, 
  trend,
  className = '' 
}: StitchStatCardProps) {
  const trendColors = {
    up: 'text-emerald-500',
    down: 'text-red-500',
    neutral: 'text-[#137fec]',
  };

  const trendIcons = {
    up: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
      </svg>
    ),
    down: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6z"/>
      </svg>
    ),
    neutral: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
      </svg>
    ),
  };

  return (
    <div className={`bg-[#1c252e] border border-[#2a3441] rounded-xl p-4 flex flex-col gap-1 ${className}`}>
      <span className="text-[#94a3b8] text-xs font-medium uppercase">{label}</span>
      <div className="text-white text-2xl font-bold font-display">{value}</div>
      {trend && (
        <div className={`flex items-center gap-1 ${trendColors[trend.direction]} text-xs`}>
          {trendIcons[trend.direction]}
          <span>{trend.value}</span>
          {trend.label && <span>{trend.label}</span>}
        </div>
      )}
    </div>
  );
}
