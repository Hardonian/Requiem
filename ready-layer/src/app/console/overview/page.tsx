'use client';

/**
 * Console Overview - Control Plane Home
 *
 * Canonical route: /console/overview
 *
 * Shows real engine status when REQUIEM_API_URL is set.
 * Shows honest standby state when engine is not connected.
 * Does NOT display fabricated metrics.
 */

import Link from 'next/link';
import {
  StitchHeader,
  StitchContainer,
  StitchBadge,
  StitchFeatureCard,
  StitchIcon,
  StitchTimeline,
} from '@/components/stitch';
import { RouteMaturityNote } from '@/components/ui';
import { getRouteMaturity, maturityNoteTone } from '@/lib/route-maturity';

const controlPlaneFeatures = [
  {
    id: 'policy',
    title: 'Policy Enforcement',
    description: 'Strict adherence to pre-defined constraints before any LLM call is dispatched.',
    icon: <StitchIcon name="gavel" className="h-5 w-5" />,
    iconBgClass: 'bg-purple-500/10',
    iconColorClass: 'text-purple-400',
  },
  {
    id: 'routing',
    title: 'Provider Decisions',
    description: 'Dynamic routing based on latency, cost, and availability metrics in real-time.',
    icon: <StitchIcon name="hub" className="h-5 w-5" />,
    iconBgClass: 'bg-blue-500/10',
    iconColorClass: 'text-blue-400',
  },
  {
    id: 'signing',
    title: 'Artifact Signing',
    description: 'Cryptographic proof of origin for every generated output and intermediate step.',
    icon: <StitchIcon name="fingerprint" className="h-5 w-5" />,
    iconBgClass: 'bg-emerald-500/10',
    iconColorClass: 'text-emerald-400',
  },
  {
    id: 'ledger',
    title: 'Cost Ledger',
    description: 'Granular token accounting and budget enforcement across all provider endpoints.',
    icon: <StitchIcon name="wallet" className="h-5 w-5" />,
    iconBgClass: 'bg-orange-500/10',
    iconColorClass: 'text-orange-400',
  },
];

const executionSteps = [
  {
    id: 'policy-check',
    title: 'Request to Policy',
    badge: '~0ms',
    description: 'Incoming requests are validated against active policy constraints.',
  },
  {
    id: 'execution',
    title: 'Execution to Manifest',
    badge: 'variable',
    description: 'LLM interaction occurs, capturing inputs, outputs, and metadata into a manifest.',
  },
  {
    id: 'ledger',
    title: 'Ledger to Replay',
    badge: '~5ms',
    description: 'Immutable ledger entry created with cryptographic signatures.',
  },
];

export default function OverviewPage() {
  const routeMaturity = getRouteMaturity('/console/overview');
  return (
    <div className="min-h-screen bg-[#101922] flex flex-col pb-20">
      <StitchHeader title="Requiem Console" />

      <StitchContainer maxWidth="md">
        <section className="px-5 pt-6">
          <RouteMaturityNote maturity={maturityNoteTone(routeMaturity.maturity)} title="Maturity disclosure">
            {routeMaturity.degradedBehavior}
          </RouteMaturityNote>
        </section>
        {/* Hero Section */}
        <section className="px-5 py-8 flex flex-col gap-4">
          <StitchBadge>Control Plane</StitchBadge>

          <h2 className="text-white text-3xl font-bold font-display leading-tight">
            Deterministic AI Execution Infrastructure
          </h2>

          <p className="text-[#94a3b8] text-base font-normal leading-relaxed">
            Policy-enforced. Signed. Replayable. Verifiable. The control plane for modern AI workloads.
          </p>

          <div className="flex flex-col gap-3 pt-2">
            <Link
              href="/console/guarantees"
              className="inline-flex items-center justify-center gap-2 rounded-lg h-10 px-5 text-sm font-semibold transition-all duration-150 bg-accent hover:brightness-110 text-white focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 w-full"
            >
              <StitchIcon name="verified" size="sm" />
              View Execution Guarantees
            </Link>
            <Link
              href="/console/architecture"
              className="inline-flex items-center justify-center gap-2 rounded-lg h-10 px-5 text-sm font-semibold transition-all duration-150 bg-surface border border-border hover:bg-surface-elevated text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 w-full"
            >
              <StitchIcon name="schema" size="sm" />
              Explore Architecture
            </Link>
          </div>
        </section>

        {/* System Status — honest standby state */}
        <section className="px-5 pb-8">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#1c252e] border border-[#2a3441] rounded-xl p-4">
              <p className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-1">Active Policies</p>
              <p className="text-2xl font-bold text-white font-display">—</p>
              <p className="text-xs text-[#94a3b8] mt-1">Connect engine to load</p>
            </div>
            <div className="bg-[#1c252e] border border-[#2a3441] rounded-xl p-4">
              <p className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-1">Total Executions</p>
              <p className="text-2xl font-bold text-white font-display">—</p>
              <p className="text-xs text-[#94a3b8] mt-1">Engine not connected</p>
            </div>
          </div>
          <p className="text-xs text-[#94a3b8] mt-3 text-center">
            Set <code className="bg-[#1c252e] px-1.5 py-0.5 rounded font-mono">REQUIEM_API_URL</code> to show live metrics.
            Live data available via <Link href="/console/runs" className="text-[#137fec] hover:underline">Runs</Link> and <Link href="/console/policies" className="text-[#137fec] hover:underline">Policies</Link>.
          </p>
        </section>

        {/* Control Plane Features */}
        <section className="px-5 pb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white text-lg font-bold font-display">Control Plane Core</h3>
            <Link href="/console/runs" className="text-[#137fec] text-xs font-bold uppercase tracking-wider hover:text-[#0b5cb5]">
              View Runs →
            </Link>
          </div>
          <div className="grid gap-3">
            {controlPlaneFeatures.map((feature) => (
              <StitchFeatureCard
                key={feature.id}
                title={feature.title}
                description={feature.description}
                icon={feature.icon}
                iconBgClass={feature.iconBgClass}
                iconColorClass={feature.iconColorClass}
              />
            ))}
          </div>
        </section>

        {/* Execution Flow */}
        <section className="px-5 pb-8">
          <h3 className="text-white text-lg font-bold font-display mb-4">Execution Flow</h3>
          <StitchTimeline steps={executionSteps} />
        </section>
      </StitchContainer>
    </div>
  );
}
