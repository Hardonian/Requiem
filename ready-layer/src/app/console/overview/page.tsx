'use client';

/**
 * ReadyLayer Control Plane Overview
 * 
 * Harvested from Stitch: ready_layer_control_plane_home_1
 * Canonical route: /console/overview
 * 
 * Features:
 * - Hero section with version badge
 * - Key stats cards
 * - Control Plane Core features grid
 * - Execution Flow timeline
 */

import { 
  StitchHeader, 
  StitchContainer, 
  StitchBadge,
  StitchStatCard,
  StitchFeatureCard,
  StitchButton,
  StitchIcon,
  StitchTimeline,
} from '@/components/stitch';

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
    badge: '0ms',
    description: 'Incoming requests are validated against active policy constraints.',
  },
  {
    id: 'execution',
    title: 'Execution to Manifest',
    badge: '120ms',
    description: 'LLM interaction occurs, capturing inputs, outputs, and metadata into a manifest.',
  },
  {
    id: 'ledger',
    title: 'Ledger to Replay',
    badge: '5ms',
    description: 'Immutable ledger entry created with cryptographic signatures.',
  },
];

export default function OverviewPage() {
  return (
    <div className="min-h-screen bg-[#101922] flex flex-col pb-20">
      <StitchHeader title="Ready Layer" />
      
      <StitchContainer maxWidth="md">
        {/* Hero Section */}
        <section className="px-5 py-8 flex flex-col gap-4">
          <StitchBadge pulse>v2.4.0 Stable</StitchBadge>
          
          <h2 className="text-white text-3xl font-bold font-display leading-tight">
            Deterministic AI Execution Infrastructure
          </h2>
          
          <p className="text-[#94a3b8] text-base font-normal leading-relaxed">
            Policy-enforced. Signed. Replayable. Verifiable. The control plane for modern AI workloads.
          </p>
          
          <div className="flex flex-col gap-3 pt-2">
            <StitchButton 
              variant="primary" 
              icon={<StitchIcon name="verified" size="sm" />}
              fullWidth
            >
              View Execution Guarantees
            </StitchButton>
            <StitchButton 
              variant="secondary" 
              icon={<StitchIcon name="schema" size="sm" />}
              fullWidth
            >
              Explore Architecture
            </StitchButton>
          </div>
        </section>

        {/* Stats Section */}
        <section className="px-5 pb-8">
          <div className="grid grid-cols-2 gap-3">
            <StitchStatCard 
              label="Active Policies" 
              value="128" 
              trend={{ direction: 'up', value: '+12%', label: 'this week' }}
            />
            <StitchStatCard 
              label="Total Executions" 
              value="8.4M" 
              trend={{ direction: 'neutral', value: '99.99%', label: 'Uptime' }}
            />
          </div>
        </section>

        {/* Control Plane Features */}
        <section className="px-5 pb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white text-lg font-bold font-display">Control Plane Core</h3>
            <button className="text-[#137fec] text-xs font-bold uppercase tracking-wider hover:text-[#0b5cb5]">
              View All
            </button>
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
