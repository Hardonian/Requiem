'use client';

/**
 * StitchTimeline - Vertical timeline with steps
 * 
 * Features:
 * - Left border with connector line
 * - Step indicators with dots
 * - Title, badge, and description per step
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
    <div className={`relative pl-4 border-l border-[#2a3441] space-y-8 ${className}`}>
      {steps.map((step) => (
        <div key={step.id} className="relative">
          {/* Dot indicator */}
          <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-[#1c252e] border-2 border-[#137fec]" />
          
          {/* Content */}
          <div className="bg-[#151e27] border border-[#2a3441] p-3 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-white text-sm font-bold">{step.title}</h4>
              {step.badge && (
                <span className="text-xs bg-[#137fec]/10 text-[#137fec] px-2 py-0.5 rounded">
                  {step.badge}
                </span>
              )}
            </div>
            <p className="text-[#94a3b8] text-xs">{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
