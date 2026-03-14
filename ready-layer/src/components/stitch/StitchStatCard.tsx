'use client';

/**
 * StitchStatCard - Statistics display card using design tokens
 */

interface StitchStatCardProps {
  key?: string;
  label: string;
  value: string | number;
  unit?: string;
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
  unit,
  trend,
  className = ''
}: StitchStatCardProps) {
  const trendColors = {
    up: 'text-success',
    down: 'text-destructive',
    neutral: 'text-accent',
  };

  const trendIcons = {
    up: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22" />
      </svg>
    ),
    down: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6 9 12.75l4.286-4.286a11.948 11.948 0 0 1 5.573 5.572l2.74 1.22" />
      </svg>
    ),
    neutral: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
      </svg>
    ),
  };

  return (
    <div className={`stitch-stat ${className}`}>
      <span className="stitch-stat-label">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="stitch-stat-value">{value}</span>
        {unit && <span className="text-sm font-medium text-muted">{unit}</span>}
      </div>
      {trend && (
        <div className={`stitch-stat-sub ${trendColors[trend.direction]}`}>
          {trendIcons[trend.direction]}
          <span>{trend.value}</span>
          {trend.label && <span className="text-muted">{trend.label}</span>}
        </div>
      )}
    </div>
  );
}
