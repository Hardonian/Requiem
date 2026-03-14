'use client';

/**
 * StitchHeader - Sticky header using design tokens
 */

interface StitchHeaderProps {
  title?: string;
  showUser?: boolean;
  className?: string;
}

export function StitchHeader({
  title = 'Ready Layer',
  showUser = true,
  className = ''
}: StitchHeaderProps) {
  return (
    <header className={`stitch-header ${className}`}>
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/15 text-accent">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0L12 17.25 6.43 14.25" />
          </svg>
        </div>
        <h1 className="text-foreground text-lg font-bold font-display tracking-tight">{title}</h1>
      </div>
      {showUser && (
        <button
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-surface-elevated transition-colors text-muted hover:text-foreground"
          aria-label="User account"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </button>
      )}
    </header>
  );
}
