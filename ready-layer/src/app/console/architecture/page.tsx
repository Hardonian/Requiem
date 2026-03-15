'use client';

/**
 * System Architecture Overview
 *
 * Canonical route: /console/architecture
 *
 * Shows truthful subsystem state by querying /api/status.
 * Falls back to explicit degraded diagnostics when backend is unreachable.
 */

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { StitchContainer, StitchCard, StitchActivityItem, StitchIcon } from '@/components/stitch';
import { RouteMaturityNote } from '@/components/ui';

interface StatusEnvelope {
  backend?: {
    reachable?: boolean;
    status?: number;
  };
  trace_id?: string;
}

type LoadState = 'loading' | 'ready' | 'error';

export default function ArchitecturePage() {
  const [status, setStatus] = useState<StatusEnvelope | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/status', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`status ${response.status}`);
        }
        const payload: StatusEnvelope = await response.json();
        setStatus(payload);
        setLoadState('ready');
      } catch {
        setLoadState('error');
      }
    };

    load();
  }, []);

  const backendReachable = Boolean(status?.backend?.reachable);

  const subsystemCards = useMemo(
    () => [
      {
        label: 'Engine API',
        value: loadState === 'loading' ? 'Checking…' : backendReachable ? 'Reachable' : 'Unavailable',
        status: backendReachable ? 'healthy' : 'degraded',
        detail: backendReachable
          ? `HTTP ${status?.backend?.status ?? 200}`
          : loadState === 'error'
            ? 'Could not query /api/status'
            : 'Set REQUIEM_API_URL and restart web runtime',
      },
      {
        label: 'Queue + Replay',
        value: backendReachable ? 'Enabled' : 'Standby',
        status: backendReachable ? 'healthy' : 'degraded',
        detail: backendReachable
          ? 'Run orchestration can be validated from /console/runs'
          : 'Replay and queue signals unavailable until backend connects',
      },
      {
        label: 'Storage + Ledger',
        value: backendReachable ? 'Observable' : 'Unknown',
        status: backendReachable ? 'healthy' : 'degraded',
        detail: backendReachable
          ? 'Use /console/objects and /console/decisions for live checks'
          : 'Storage diagnostics are hidden in degraded mode',
      },
      {
        label: 'Policy Surface',
        value: 'Configured',
        status: 'healthy',
        detail: 'Policy pathways are defined; runtime enforcement needs backend reachability.',
      },
    ],
    [backendReachable, loadState, status?.backend?.status],
  );

  const recentActivity = [
    {
      id: 'engine',
      title: backendReachable ? 'Engine status reachable' : 'Engine status unavailable',
      description: backendReachable
        ? 'Control plane can query backend health and diagnostics.'
        : 'Frontend is in truthful degraded mode with local-only diagnostics.',
      timestamp: 'just now',
      icon: <StitchIcon name={backendReachable ? 'check-circle' : 'warning'} className="h-4 w-4" />,
      iconBgClass: backendReachable ? 'bg-green-500/10' : 'bg-yellow-500/10',
      iconColorClass: backendReachable ? 'text-green-500' : 'text-yellow-500',
    },
    {
      id: 'runs',
      title: 'Run verification surface',
      description: backendReachable
        ? 'Use /console/runs to inspect and verify deterministic execution.'
        : 'Run verification disabled until backend becomes reachable.',
      timestamp: 'just now',
      icon: <StitchIcon name="sync" className="h-4 w-4" />,
      iconBgClass: 'bg-blue-500/10',
      iconColorClass: 'text-blue-500',
    },
    {
      id: 'policy',
      title: 'Policy choke point visible',
      description: 'Architecture map reflects the real policy-first execution path without synthetic throughput claims.',
      timestamp: 'now',
      icon: <StitchIcon name="shield" className="h-4 w-4" />,
      iconBgClass: 'bg-purple-500/10',
      iconColorClass: 'text-purple-500',
    },
  ];

  return (
    <div className="min-h-screen bg-[#101922] flex flex-col overflow-x-hidden">
      <header className="sticky top-0 z-50 bg-[#101922]/95 backdrop-blur-md border-b border-[#2a3441]">
        <div className="flex items-center justify-between px-4 py-3">
          <Link
            href="/console"
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#1c252e] transition-colors focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Back to console"
          >
            <StitchIcon name="arrow-back" className="text-white" />
          </Link>
          <h1 className="text-lg font-bold tracking-tight text-center flex-1 text-white font-display">System Architecture</h1>
          <Link
            href="/docs"
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#1c252e] transition-colors focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Documentation"
          >
            <StitchIcon name="article" className="text-[#137fec]" />
          </Link>
        </div>
      </header>

      <StitchContainer maxWidth="md">

        <RouteMaturityNote maturity="runtime-degraded" title="Maturity: runtime route with explicit degraded mode">
          Topology status is live only when <code className="font-mono">/api/status</code> is reachable. Otherwise this route remains diagnostic-only and intentionally suppresses fabricated subsystem health.
        </RouteMaturityNote>

        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2 text-white font-display">Control Plane Topology</h2>
          <p className="text-sm text-[#94a3b8] leading-relaxed">
            Policy-first execution path with explicit subsystem diagnostics. No synthetic performance metrics are displayed.
          </p>
        </div>

        <div className="relative bg-[#1c252e] rounded-xl border border-[#2a3441] p-6 shadow-sm mb-6">
          <div className="relative z-10 flex flex-col items-center gap-6">
            <div className="w-32 h-12 bg-[#0f172a] rounded-lg flex items-center justify-center border border-[#2a3441] shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-white">CLI / API</span>
            </div>
            <div className="text-[#94a3b8]">
              <StitchIcon name="arrow-down" />
            </div>
            <div className="w-full p-4 bg-[#137fec]/10 rounded-xl border border-[#137fec]/30 flex flex-col items-center text-center">
              <h3 className="text-[#137fec] font-bold text-sm mb-1 font-display">Policy Engine</h3>
              <p className="text-[10px] text-[#94a3b8]">Single choke point enforcement</p>
            </div>
            <div className="text-[#94a3b8]">
              <StitchIcon name="arrow-down" />
            </div>
            <div className="w-full grid grid-cols-2 gap-3">
              <div className="p-3 bg-[#0f172a]/50 rounded-lg border border-[#2a3441]">
                <p className="text-xs font-bold text-white">Execution</p>
                <p className="text-[10px] text-[#94a3b8]">Runtime and queue</p>
              </div>
              <div className="p-3 bg-[#0f172a]/50 rounded-lg border border-[#2a3441]">
                <p className="text-xs font-bold text-white">Ledger / Storage</p>
                <p className="text-[10px] text-[#94a3b8]">Receipts and object records</p>
              </div>
            </div>
          </div>
        </div>

        <h3 className="text-lg font-bold mb-3 px-1 text-white font-display">Subsystem Status</h3>
        <div className="grid grid-cols-1 gap-3 mb-6">
          {subsystemCards.map((metric) => (
            <StitchCard key={metric.label} padding="md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-[#94a3b8] font-medium">{metric.label}</p>
                  <p className="text-lg font-bold text-white font-display">{metric.value}</p>
                  <p className="text-xs text-[#94a3b8] mt-1">{metric.detail}</p>
                </div>
                <span
                  className={`mt-1 h-2.5 w-2.5 rounded-full ${metric.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'}`}
                  aria-label={metric.status}
                />
              </div>
            </StitchCard>
          ))}
        </div>

        <h3 className="text-lg font-bold mb-3 px-1 text-white font-display">Recent Activity</h3>
        <div className="bg-[#1c252e] rounded-xl border border-[#2a3441] overflow-hidden">
          {recentActivity.map((item, index) => (
            <StitchActivityItem
              key={item.id}
              title={item.title}
              description={item.description}
              timestamp={item.timestamp}
              icon={item.icon}
              iconBgClass={item.iconBgClass}
              iconColorClass={item.iconColorClass}
              last={index === recentActivity.length - 1}
            />
          ))}
        </div>
      </StitchContainer>
    </div>
  );
}
