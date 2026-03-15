'use client';

import type { ReactNode } from 'react';

type RouteMaturity = 'runtime' | 'runtime-degraded' | 'demo' | 'informational';

const toneByMaturity: Record<RouteMaturity, string> = {
  runtime: 'border-success/30 bg-success/10 text-foreground',
  'runtime-degraded': 'border-warning/30 bg-warning/10 text-foreground',
  demo: 'border-accent/30 bg-accent/10 text-foreground',
  informational: 'border-border bg-surface-elevated text-foreground',
};

interface RouteMaturityNoteProps {
  maturity: RouteMaturity;
  title: string;
  children: ReactNode;
  className?: string;
}

export function RouteMaturityNote({ maturity, title, children, className = '' }: RouteMaturityNoteProps) {
  return (
    <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${toneByMaturity[maturity]} ${className}`} role="status">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
      <div className="mt-1 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

