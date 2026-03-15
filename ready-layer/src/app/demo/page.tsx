// ready-layer/src/app/demo/page.tsx
//
// 60-Second Live Demo Page
// Pre-configured demo with event stream, receipt hash, and verification

'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { RouteMaturityNote } from '@/components/ui';
import { HashDisplay, VerificationBadge } from '@/components/ui';

// Simulated event types
interface DemoEvent {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'hash' | 'verify';
  message: string;
  detail?: string;
}

// Mock demo events sequence
const DEMO_EVENTS: DemoEvent[] = [
  { id: '1', timestamp: '00:00.123', type: 'info', message: 'Loading plan...', detail: 'demo-hello-world.yaml' },
  { id: '2', timestamp: '00:00.245', type: 'info', message: 'Policy check', detail: 'capability:demo granted' },
  { id: '3', timestamp: '00:00.389', type: 'info', message: 'Budget allocated', detail: '100 compute units' },
  { id: '4', timestamp: '00:00.512', type: 'info', message: 'Executing step 1/3', detail: 'system.echo' },
  { id: '5', timestamp: '00:00.678', type: 'success', message: 'Step 1 complete', detail: 'output: "Hello, World!"' },
  { id: '6', timestamp: '00:00.789', type: 'info', message: 'Executing step 2/3', detail: 'system.hash' },
  { id: '7', timestamp: '00:00.891', type: 'success', message: 'Step 2 complete', detail: 'BLAKE3 hash computed' },
  { id: '8', timestamp: '00:01.023', type: 'info', message: 'Executing step 3/3', detail: 'system.verify' },
  { id: '9', timestamp: '00:01.156', type: 'success', message: 'Step 3 complete', detail: 'Determinism verified' },
  { id: '10', timestamp: '00:01.234', type: 'hash', message: 'Receipt generated', detail: 'a39f8c2d4e5b6f7a8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b' },
  { id: '11', timestamp: '00:01.345', type: 'verify', message: 'Verification complete', detail: 'All checks passed' },
];

const RECEIPT_HASH = 'a39f8c2d4e5b6f7a8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b';

function EventRow({ event }: { event: DemoEvent }) {
  const typeColors = {
    info: 'text-blue-600 bg-blue-50',
    success: 'text-emerald-600 bg-emerald-50',
    hash: 'text-purple-600 bg-purple-50',
    verify: 'text-emerald-600 bg-emerald-50',
  };

  const icons = {
    info: '→',
    success: '✓',
    hash: '#',
    verify: '✓',
  };

  return (
    <div className="flex items-start gap-3 py-2 animate-in fade-in slide-in-from-left-2 duration-300">
      <span className="text-xs text-gray-400 font-mono w-16 flex-shrink-0 pt-0.5">
        {event.timestamp}
      </span>
      <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold flex-shrink-0 ${typeColors[event.type]}`}>
        {icons[event.type]}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-700">{event.message}</span>
        {event.detail && (
          <span className="text-xs text-gray-400 ml-2">{event.detail}</span>
        )}
      </div>
    </div>
  );
}

function ReplayBadge() {
  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
      <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      <span className="text-sm font-semibold text-emerald-700">Replay Proven</span>
      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  );
}

export default function DemoPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [visibleEvents, setVisibleEvents] = useState<DemoEvent[]>([]);
  const [progress, setProgress] = useState(0);

  const runDemo = useCallback(async () => {
    setIsRunning(true);
    setIsComplete(false);
    setVisibleEvents([]);
    setProgress(0);

    // Stream events with delays
    for (let i = 0; i < DEMO_EVENTS.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 180));
      setVisibleEvents(prev => [...prev, DEMO_EVENTS[i]]);
      setProgress(((i + 1) / DEMO_EVENTS.length) * 100);
    }

    setIsComplete(true);
    setIsRunning(false);
  }, []);

  const resetDemo = useCallback(() => {
    setIsRunning(false);
    setIsComplete(false);
    setVisibleEvents([]);
    setProgress(0);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">60-Second Demo</h1>
              <p className="text-slate-400 text-sm mt-1">
                Local scripted walkthrough
              </p>
            </div>
            <Link
              href="/"
              className="text-slate-400 hover:text-white transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        <RouteMaturityNote maturity="demo" title="Maturity: demo route">
          This flow replays local scripted events for UX validation. It does not prove backend execution, policy enforcement, or receipt generation against a live runtime.
        </RouteMaturityNote>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Controls & Status */}
          <div className="space-y-6">
            {/* Run Controls */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                Demo Configuration
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Plan</span>
                  <span className="font-mono text-slate-900">hello-world.yaml</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Capability</span>
                  <span className="font-mono text-slate-900">demo</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Policy</span>
                  <span className="font-mono text-slate-900">allow-all</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Steps</span>
                  <span className="font-mono text-slate-900">3</span>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                {!isRunning && !isComplete && (
                  <button
                    onClick={runDemo}
                    className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-lg font-semibold transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Run Demo
                  </button>
                )}
                {isRunning && (
                  <button
                    disabled
                    className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-slate-100 text-slate-400 rounded-lg font-semibold cursor-not-allowed"
                  >
                    <svg className="w-5 h-5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Running...
                  </button>
                )}
                {isComplete && (
                  <button
                    onClick={resetDemo}
                    className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Replay
                  </button>
                )}
              </div>

              {/* Progress bar */}
              {(isRunning || isComplete) && (
                <div className="mt-4">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="text-right text-xs text-slate-400 mt-1">
                    {Math.round(progress)}%
                  </div>
                </div>
              )}
            </div>

            {/* Receipt (shown when complete) */}
            {isComplete && (
              <div className="bg-white rounded-xl border border-emerald-200 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                  Execution Receipt
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Receipt Hash</label>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <HashDisplay hash={RECEIPT_HASH} length={32} showCopy />
                    </div>
                  </div>

                  <VerificationBadge
                    status="verified"
                    message="Verification passed"
                    details="Deterministic execution verified. Result digest matches expected hash."
                  />

                  <div className="flex justify-center pt-2">
                    <ReplayBadge />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Event Stream */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-slate-700">Event Stream</span>
              </div>
              {isRunning && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Live
                </span>
              )}
            </div>
            
            <div className="p-4 h-96 overflow-y-auto font-mono text-sm bg-slate-950">
              {visibleEvents.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <svg className="w-12 h-12 mx-auto mb-3 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>Click &quot;Run Demo&quot; to start</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {visibleEvents.map(event => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* What Just Happened */}
        {isComplete && (
          <div className="mt-8 bg-emerald-50 rounded-xl border border-emerald-200 p-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h3 className="text-lg font-semibold text-emerald-900 mb-3">
              What just happened?
            </h3>
            <ul className="space-y-2 text-emerald-800">
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Your plan executed through the policy gate — every step was capability-checked and budget-metered.</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>A cryptographic receipt was generated — the BLAKE3 hash proves exactly what executed.</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Verification passed — the execution is replayable and auditable to the byte.</span>
              </li>
            </ul>
            <div className="mt-4 flex gap-3">
              <Link
                href="/console"
                className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
              >
                Try in Console
              </Link>
              <a
                href="https://github.com/reachhq/requiem"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-white hover:bg-emerald-100 text-emerald-700 rounded-lg font-medium transition-colors"
              >
                Read Documentation
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
