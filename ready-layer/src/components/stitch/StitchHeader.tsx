'use client';

/**
 * StitchHeader - Sticky header with ReadyLayer branding
 * 
 * Features:
 * - Logo with Material Symbol icon
 * - Title display
 * - User avatar button
 * - Responsive design
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
    <header className={`sticky top-0 z-50 bg-[#101922]/95 backdrop-blur border-b border-[#2a3441] px-4 py-3 flex items-center justify-between ${className}`}>
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded bg-[#137fec]/20 text-[#137fec]">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <h1 className="text-white text-lg font-bold font-display tracking-tight">{title}</h1>
      </div>
      {showUser && (
        <button 
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#1c252e] transition-colors text-white"
          aria-label="User account"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </button>
      )}
    </header>
  );
}
