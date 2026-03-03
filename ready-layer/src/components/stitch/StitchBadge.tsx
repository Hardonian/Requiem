'use client';

/**
 * StitchBadge - Status badge with pulse animation option
 * 
 * Variants:
 * - default: Primary color with border
 * - success: Green accent
 * - warning: Yellow/amber accent
 * - error: Red accent
 */

interface StitchBadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error';
  pulse?: boolean;
  className?: string;
}

export function StitchBadge({ 
  children, 
  variant = 'default',
  pulse = false,
  className = '' 
}: StitchBadgeProps) {
  const variantClasses = {
    default: 'bg-[#137fec]/10 border-[#137fec]/20 text-[#137fec]',
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
    warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500',
    error: 'bg-red-500/10 border-red-500/20 text-red-500',
  };

  return (
    <div className={`
      inline-flex items-center gap-2 self-start rounded-full 
      px-3 py-1 border text-xs font-medium uppercase tracking-wider
      ${variantClasses[variant]}
      ${className}
    `}>
      {pulse && (
        <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
      )}
      {children}
    </div>
  );
}
