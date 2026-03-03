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

import { 
  StitchHeader, 
  StitchContainer, 
  StitchCard,
  StitchFeatureCard,
  StitchStatCard,
  StitchBadge,
  StitchIcon,
} from '@/components/stitch';

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

const verificationStats = [
  { label: 'Verified Executions', value: '99.99%', trend: { direction: 'up' as const, value: '+0.01%' } },
  { label: 'Replay Success', value: '100%', trend: { direction: 'neutral' as const, value: 'Stable' } },
];

export default function GuaranteesPage() {
  return (
    <div className="min-h-screen bg-[#101922] flex flex-col pb-20">
      <StitchHeader title="Execution Guarantees" />
      
      <StitchContainer maxWidth="md">
        {/* Hero Section */}
        <section className="px-5 py-8 flex flex-col gap-4">
          <StitchBadge variant="success">All Systems Operational</StitchBadge>
          
          <h2 className="text-white text-3xl font-bold font-display leading-tight">
            Execution Guarantees
          </h2>
          
          <p className="text-[#94a3b8] text-base font-normal leading-relaxed">
            Deterministic AI execution with cryptographic proofs. Policy-enforced at every step. 
            Verifiable by design, not by promise.
          </p>
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
            <h3 className="text-white text-lg font-bold font-display">Core Guarantees</h3>
            <StitchBadge variant="success">4/4 Active</StitchBadge>
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
              <div className="w-10 h-10 rounded-lg bg-[#137fec]/10 flex items-center justify-center text-[#137fec] shrink-0">
                <StitchIcon name="shield" className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-white font-bold font-display text-base mb-1">
                  Single Choke Point Policy
                </h4>
                <p className="text-[#94a3b8] text-xs leading-relaxed mb-3">
                  All execution paths flow through a single policy enforcement point. 
                  No bypass paths exist. Every LLM call is validated against active constraints 
                  before dispatch.
                </p>
                <div className="flex gap-2">
                  <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded">
                    Enforced
                  </span>
                  <span className="text-xs bg-[#137fec]/10 text-[#137fec] px-2 py-1 rounded">
                    Immutable
                  </span>
                </div>
              </div>
            </div>
          </StitchCard>
        </section>
      </StitchContainer>
    </div>
  );
}
