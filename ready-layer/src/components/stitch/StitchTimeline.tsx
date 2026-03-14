'use client';

/**
 * StitchTimeline - Vertical timeline using design tokens
 */

interface TimelineStep {
  id: string;
  title: string;
  badge?: string;
  description: string;
}

interface StitchTimelineProps {
  steps: TimelineStep[];
  className?: string;
}

export function StitchTimeline({ steps, className = '' }: StitchTimelineProps) {
  return (
    <div className={`relative pl-4 border-l border-border space-y-8 ${className}`}>
      {steps.map((step) => (
        <div key={step.id} className="relative">
          <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-surface border-2 border-accent" aria-hidden="true" />
          <div className="bg-surface-elevated border border-border p-3 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-foreground text-sm font-bold">{step.title}</h4>
              {step.badge && (
                <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded font-medium">
                  {step.badge}
                </span>
              )}
            </div>
            <p className="text-muted text-xs">{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
