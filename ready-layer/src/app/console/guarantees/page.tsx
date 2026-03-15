'use client';

/**
 * Execution Guarantees
 * 
 * Harvested from Stitch: execution_guarantees_deep_dive_1
 * Canonical route: /console/guarantees
 * 
 * Features:
 * - Guarantee cards with severity levels
 * - Verification metrics
 * - Compliance status
 */

import { type ReactNode, useEffect, useState } from 'react';
import {
  StitchHeader, 
  StitchContainer, 
  StitchCard,
  StitchFeatureCard,
  StitchStatCard,
  StitchBadge,
  StitchIcon,
} from '@/components/stitch';
import { RouteMaturityNote } from '@/components/ui';
import { getRouteMaturity, maturityNoteTone } from '@/lib/route-maturity';

interface StatusEnvelope {
  backend?: {
    reachable?: boolean;
    status?: number;
  };
}

const guarantees = [
  {
    id: 'deterministic',
    title: 'Deterministic Execution',
    description: 'Same inputs always produce identical outputs. Execution is fully reproducible with bit-level parity.',
    icon: <StitchIcon name="settings" className="h-5 w-5" />,
    iconBgClass: 'bg-blue-500/10',
    iconColorClass: 'text-blue-400',
    level: 'critical',
  },
  {
    id: 'signed',
    title: 'Cryptographic Signing',
    description: 'Every execution produces a signed receipt. Verify provenance without trusting the execution environment.',
    icon: <StitchIcon name="fingerprint" className="h-5 w-5" />,
    iconBgClass: 'bg-purple-500/10',
    iconColorClass: 'text-purple-400',
    level: 'critical',
  },
  {
    id: 'replayable',
    title: 'Deterministic Replay',
    description: 'Re-run any execution with guaranteed identical results. Debug production issues with certainty.',
    icon: <StitchIcon name="sync" className="h-5 w-5" />,
    iconBgClass: 'bg-emerald-500/10',
    iconColorClass: 'text-emerald-400',
    level: 'high',
  },
  {
    id: 'auditable',
    title: 'Full Audit Trail',
    description: 'Complete trace of every decision, policy check, and execution step. Immutable ledger storage.',
    icon: <StitchIcon name="article" className="h-5 w-5" />,
    iconBgClass: 'bg-orange-500/10',
    iconColorClass: 'text-orange-400',
    level: 'high',
  },
];

export default function GuaranteesPage() {
  const routeMaturity = getRouteMaturity('/console/guarantees');
  const [status, setStatus] = useState<StatusEnvelope | null>(null);
  const [statusState, setStatusState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const response = await fetch('/api/status', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Status endpoint failed: ${response.status}`);
        }

        const payload: StatusEnvelope = await response.json();
        setStatus(payload);
        setStatusState('ready');
      } catch {
        setStatusState('error');
      }
    };

    loadStatus();
  }, []);

  const backendReachable = status?.backend?.reachable;
  const isHealthy = statusState === 'ready' && backendReachable;

  const verificationStats: Array<{
    label: string;
    value: string;
    trend?: { direction: 'up' | 'down' | 'neutral'; value: string };
  }> = [
    {
      label: 'Verification Surface',
      value:
        statusState === 'loading'
          ? 'Checking…'
          : isHealthy
            ? 'Live'
            : statusState === 'error'
              ? 'Unavailable'
              : 'Degraded',
      trend: {
        direction: isHealthy ? 'up' : 'neutral',
        value: isHealthy ? 'Backend reachable' : 'Local guarantees only',
      },
    },
    {
      label: 'Replay Validation',
      value: isHealthy ? 'Enabled' : 'Standby',
      trend: {
        direction: 'neutral',
        value: isHealthy ? 'Use /console/runs to verify' : 'Connect REQUIEM_API_URL',
      },
    },
  ];

  const guaranteeStatusBadge: { text: string; variant: 'success' | 'warning' | 'error'; } = isHealthy
    ? { text: 'Engine-connected', variant: 'success' }
    : { text: 'Degraded: local-only', variant: 'warning' };

  const policyChips: Array<{ text: string; className: string; icon?: ReactNode }> = [
    {
      text: isHealthy ? 'Policy checks reachable' : 'Policy checks unavailable',
      className: isHealthy ? 'text-xs bg-success/10 text-success px-2 py-1 rounded' : 'text-xs bg-warning/10 text-warning px-2 py-1 rounded',
    },
    {
      text: isHealthy ? 'Deterministic replay enabled' : 'Replay requires backend',
      className: 'text-xs bg-accent/10 text-accent px-2 py-1 rounded',
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      <StitchHeader title="Execution Guarantees" />
      
      <StitchContainer maxWidth="md">
        <section className="px-5 pt-6">
          <RouteMaturityNote maturity={maturityNoteTone(routeMaturity.maturity)} title="Maturity disclosure">
            {routeMaturity.degradedBehavior}
          </RouteMaturityNote>
        </section>
        {/* Hero Section */}
        <section className="px-5 py-8 flex flex-col gap-4">
          <StitchBadge variant={guaranteeStatusBadge.variant}>{guaranteeStatusBadge.text}</StitchBadge>
          
          <h2 className="text-foreground text-3xl font-bold font-display leading-tight">
            Execution Guarantees
          </h2>

          <p className="text-muted text-base font-normal leading-relaxed">
            Guarantee definitions are stable, while live enforcement evidence depends on backend reachability and verification surfaces.
          </p>
          {!isHealthy && (
            <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-400/20 rounded-md px-3 py-2">
              Live guarantee verification is currently unavailable. This page is showing static guarantee definitions and local status only.
            </p>
          )}
        </section>

        {/* Verification Stats */}
        <section className="px-5 pb-8">
          <div className="grid grid-cols-2 gap-3">
            {verificationStats.map((stat) => (
              <StitchStatCard 
                key={stat.label}
                label={stat.label}
                value={stat.value}
                trend={stat.trend}
              />
            ))}
          </div>
        </section>

        {/* Guarantees List */}
        <section className="px-5 pb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-foreground text-lg font-bold font-display">Core Guarantees</h3>
            <StitchBadge variant={guaranteeStatusBadge.variant}>{isHealthy ? '4/4 Reachable' : 'Definitions loaded'}</StitchBadge>
          </div>
          <div className="grid gap-3">
            {guarantees.map((guarantee) => (
              <StitchFeatureCard
                key={guarantee.id}
                title={guarantee.title}
                description={guarantee.description}
                icon={guarantee.icon}
                iconBgClass={guarantee.iconBgClass}
                iconColorClass={guarantee.iconColorClass}
              />
            ))}
          </div>
        </section>

        {/* Policy Enforcement Notice */}
        <section className="px-5 pb-8">
          <StitchCard padding="lg">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0">
                <StitchIcon name="shield" className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-foreground font-bold font-display text-base mb-1">
                  Single Choke Point Policy
                </h4>
                <p className="text-muted text-xs leading-relaxed mb-3">
                  All execution paths flow through a single policy enforcement point. 
                  No bypass paths exist. Every LLM call is validated against active constraints 
                  before dispatch.
                </p>
                <div className="flex gap-2">
                  {policyChips.map((chip) => (
                    <span key={chip.text} className={chip.className}>
                      {chip.text}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </StitchCard>
        </section>
      </StitchContainer>
    </div>
  );
}
