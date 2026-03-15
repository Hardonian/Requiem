import type { ReactNode } from 'react';

type Tone = 'neutral' | 'warning' | 'critical';

const toneClass: Record<Tone, string> = {
  neutral: 'border-border bg-surface text-foreground',
  warning: 'border-warning/30 bg-warning/10 text-foreground',
  critical: 'border-destructive/30 bg-destructive/5 text-foreground',
};

const badgeClass: Record<Tone, string> = {
  neutral: 'border-border bg-surface-elevated text-muted',
  warning: 'border-warning/40 bg-warning/15 text-warning',
  critical: 'border-destructive/40 bg-destructive/10 text-destructive',
};

interface RouteTruthStateCardProps {
  title: string;
  detail: string;
  nextStep?: string;
  stateLabel: string;
  tone?: Tone;
  actions?: ReactNode;
}

export function RouteTruthStateCard({
  title,
  detail,
  nextStep,
  stateLabel,
  tone = 'neutral',
  actions,
}: RouteTruthStateCardProps) {
  return (
    <div className={`rounded-xl border p-4 ${toneClass[tone]}`}>
      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeClass[tone]}`}>
        {stateLabel}
      </span>
      <p className="mt-2 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{detail}</p>
      {nextStep && <p className="mt-2 text-xs text-muted">Next step: {nextStep}</p>}
      {actions && <div className="mt-3">{actions}</div>}
    </div>
  );
}
