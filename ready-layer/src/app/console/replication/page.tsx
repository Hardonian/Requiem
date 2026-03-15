'use client';

/**
 * Multi-Region Replication
 * 
 * Harvested from Stitch: multi_region_replication_protocol
 * Canonical route: /console/replication
 * 
 * Features:
 * - Region status cards
 * - Replication topology
 * - Sync metrics
 */

import { 
  StitchHeader, 
  StitchContainer, 
  StitchCard,
  StitchStatCard,
  StitchBadge,
  StitchActivityItem,
  StitchIcon,
} from '@/components/stitch';
import { RouteMaturityNote } from '@/components/ui';
import { getRouteMaturity, maturityNoteTone } from '@/lib/route-maturity';

const regions = [
  { id: 'us-east-1', name: 'US East (N. Virginia)', status: 'healthy', lag: '2ms', throughput: '1.2GB/s' },
  { id: 'us-west-2', name: 'US West (Oregon)', status: 'healthy', lag: '45ms', throughput: '1.1GB/s' },
  { id: 'eu-west-1', name: 'EU (Ireland)', status: 'warning', lag: '120ms', throughput: '980MB/s' },
  { id: 'ap-south-1', name: 'Asia Pacific (Mumbai)', status: 'healthy', lag: '85ms', throughput: '850MB/s' },
];

const replicationStats = [
  { label: 'Global Lag', value: '45ms', trend: { direction: 'up' as const, value: '-12ms' } },
  { label: 'Throughput', value: '4.1GB/s', trend: { direction: 'neutral' as const, value: 'Stable' } },
];

const recentEvents = [
  {
    id: '1',
    title: 'Sync Completed',
    description: 'us-west-2 caught up to head',
    timestamp: '30s ago',
    icon: <StitchIcon name="check-circle" className="h-4 w-4" />,
    iconBgClass: 'bg-success/10',
    iconColorClass: 'text-success',
  },
  {
    id: '2',
    title: 'Lag Alert',
    description: 'eu-west-1 experiencing higher latency',
    timestamp: '2m ago',
    icon: <StitchIcon name="warning" className="h-4 w-4" />,
    iconBgClass: 'bg-warning/10',
    iconColorClass: 'text-warning',
  },
  {
    id: '3',
    title: 'Snapshot Sync',
    description: 'ap-south-1 received daily snapshot',
    timestamp: '15m ago',
    icon: <StitchIcon name="sync" className="h-4 w-4" />,
    iconBgClass: 'bg-accent/10',
    iconColorClass: 'text-accent',
  },
];

export default function ReplicationPage() {
  const routeMaturity = getRouteMaturity('/console/replication');

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      <StitchHeader title="Multi-Region Replication" />
      
      <StitchContainer maxWidth="md">
        <section className="px-5 pt-6">
          <RouteMaturityNote maturity={maturityNoteTone(routeMaturity.maturity)} title="Maturity: informational route">
            {routeMaturity.degradedBehavior}
          </RouteMaturityNote>
        </section>

        {/* Hero Section */}
        <section className="px-5 py-8 flex flex-col gap-4">
          <StitchBadge variant="success">Replication Surface</StitchBadge>
          
          <h2 className="text-foreground text-3xl font-bold font-display leading-tight">
            Replication Diagnostics
          </h2>

          <p className="text-muted text-base font-normal leading-relaxed">
            Reference topology and synthetic region telemetry for replication workflows. Treat values here as informational until connected backend telemetry is available.
          </p>
        </section>

        {/* Stats */}
        <section className="px-5 pb-8">
          <div className="grid grid-cols-2 gap-3">
            {replicationStats.map((stat) => (
              <StitchStatCard 
                key={stat.label}
                label={stat.label}
                value={stat.value}
                trend={stat.trend}
              />
            ))}
          </div>
        </section>

        {/* Region Status */}
        <section className="px-5 pb-8">
          <h3 className="text-foreground text-lg font-bold font-display mb-4">Region Status</h3>
          <div className="grid gap-3">
            {regions.map((region) => (
              <StitchCard key={region.id} padding="md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      region.status === 'healthy' ? 'bg-success' : 'bg-warning'
                    }`} />
                    <div>
                      <div className="text-foreground font-medium text-sm">{region.name}</div>
                      <div className="text-muted text-xs">{region.id}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-foreground text-sm font-medium">{region.lag}</div>
                    <div className="text-muted text-xs">{region.throughput}</div>
                  </div>
                </div>
              </StitchCard>
            ))}
          </div>
        </section>

        {/* Replication Topology */}
        <section className="px-5 pb-8">
          <h3 className="text-foreground text-lg font-bold font-display mb-4">Topology</h3>
          <StitchCard padding="lg">
            <div className="flex flex-col items-center gap-4">
              <div className="w-full p-4 bg-accent/10 rounded-lg border border-accent/30 text-center">
                <StitchIcon name="database" className="text-accent mx-auto mb-2" />
                <div className="text-foreground font-bold text-sm">Primary Ledger</div>
                <div className="text-muted text-xs">us-east-1</div>
              </div>

              <div className="w-full grid grid-cols-3 gap-2">
                {['us-west-2', 'eu-west-1', 'ap-south-1'].map((region) => (
                  <div key={region} className="p-3 bg-surface-elevated rounded-lg border border-border text-center">
                    <StitchIcon name="sync" className="text-muted mx-auto mb-1" size="sm" />
                    <div className="text-foreground text-xs font-medium">{region}</div>
                  </div>
                ))}
              </div>
            </div>
          </StitchCard>
        </section>

        {/* Recent Events */}
        <section className="px-5 pb-8">
          <h3 className="text-foreground text-lg font-bold font-display mb-3">Recent Events</h3>
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            {recentEvents.map((item, index) => (
              <StitchActivityItem
                key={item.id}
                title={item.title}
                description={item.description}
                timestamp={item.timestamp}
                icon={item.icon}
                iconBgClass={item.iconBgClass}
                iconColorClass={item.iconColorClass}
                last={index === recentEvents.length - 1}
              />
            ))}
          </div>
        </section>
      </StitchContainer>
    </div>
  );
}
