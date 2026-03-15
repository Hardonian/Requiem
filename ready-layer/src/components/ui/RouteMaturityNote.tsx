import type { ReactNode } from 'react';
import { AlertTriangle, BookOpen, FlaskConical, ShieldCheck } from 'lucide-react';

export type RouteMaturity = 'runtime' | 'runtime-degraded' | 'demo' | 'informational';

const toneByMaturity: Record<RouteMaturity, { shell: string; icon: ReactNode; label: string }> = {
  runtime: {
    shell: 'border-emerald-500/30 bg-emerald-500/10 text-foreground',
    icon: <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />,
    label: 'Runtime-backed',
  },
  'runtime-degraded': {
    shell: 'border-warning/30 bg-warning/10 text-foreground',
    icon: <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />,
    label: 'Runtime-degraded',
  },
  demo: {
    shell: 'border-accent/30 bg-accent/10 text-foreground',
    icon: <FlaskConical className="h-4 w-4 text-accent" aria-hidden="true" />,
    label: 'Demo route',
  },
  informational: {
    shell: 'border-border bg-surface-elevated text-foreground',
    icon: <BookOpen className="h-4 w-4 text-muted" aria-hidden="true" />,
    label: 'Informational route',
  },
};

interface RouteMaturityNoteProps {
  maturity: RouteMaturity;
  title: string;
  children: ReactNode;
  className?: string;
}

export function RouteMaturityNote({ maturity, title, children, className = '' }: RouteMaturityNoteProps) {
  const tone = toneByMaturity[maturity];
  return (
    <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${tone.shell} ${className}`} role="status">
      <div className="mb-1.5 flex items-center gap-2">
        {tone.icon}
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{tone.label}</span>
      </div>
      <p className="font-semibold">{title}</p>
      <div className="mt-1 text-sm leading-relaxed text-foreground/80">{children}</div>
    </div>
  );
}
