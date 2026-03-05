import React from 'react';

export interface ReplayTimelineEvent {
  id: string;
  timestamp: string;
  label: string;
  status: 'ok' | 'warn' | 'error';
}

export function ReplayTimeline({ events, activeId, onSelect }: {
  events: ReplayTimelineEvent[];
  activeId?: string;
  onSelect?: (id: string) => void;
}): JSX.Element {
  return (
    <section aria-label="Replay Timeline" className="space-y-2">
      {events.map((event) => (
        <button
          key={event.id}
          type="button"
          onClick={() => onSelect?.(event.id)}
          className={`w-full rounded-md border p-3 text-left ${activeId === event.id ? 'border-blue-500' : 'border-slate-300'}`}
        >
          <div className="text-xs text-slate-500">{event.timestamp}</div>
          <div className="font-medium">{event.label}</div>
          <div className="text-xs uppercase">{event.status}</div>
        </button>
      ))}
    </section>
  );
}
