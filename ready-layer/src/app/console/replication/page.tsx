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
    iconBgClass: 'bg-green-500/10',
    iconColorClass: 'text-green-500',
  },
  {
    id: '2',
    title: 'Lag Alert',
    description: 'eu-west-1 experiencing higher latency',
    timestamp: '2m ago',
    icon: <StitchIcon name="warning" className="h-4 w-4" />,
    iconBgClass: 'bg-yellow-500/10',
    iconColorClass: 'text-yellow-500',
  },
  {
    id: '3',
    title: 'Snapshot Sync',
    description: 'ap-south-1 received daily snapshot',
    timestamp: '15m ago',
    icon: <StitchIcon name="sync" className="h-4 w-4" />,
    iconBgClass: 'bg-blue-500/10',
    iconColorClass: 'text-blue-500',
  },
];

export default function ReplicationPage() {
  return (
    <div className="min-h-screen bg-[#101922] flex flex-col pb-20">
      <StitchHeader title="Multi-Region Replication" />
      
      <StitchContainer maxWidth="md">
        {/* Hero Section */}
        <section className="px-5 py-8 flex flex-col gap-4">
          <StitchBadge variant="success">Active Replication</StitchBadge>
          
          <h2 className="text-white text-3xl font-bold font-display leading-tight">
            Global Replication
          </h2>
          
          <p className="text-[#94a3b8] text-base font-normal leading-relaxed">
            Append-only streams with automatic failover. Content-addressable storage 
            ensures integrity across all regions.
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
          <h3 className="text-white text-lg font-bold font-display mb-4">Region Status</h3>
          <div className="grid gap-3">
            {regions.map((region) => (
              <StitchCard key={region.id} padding="md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      region.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
                    }`} />
                    <div>
                      <div className="text-white font-medium text-sm">{region.name}</div>
                      <div className="text-[#94a3b8] text-xs">{region.id}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white text-sm font-medium">{region.lag}</div>
                    <div className="text-[#94a3b8] text-xs">{region.throughput}</div>
                  </div>
                </div>
              </StitchCard>
            ))}
          </div>
        </section>

        {/* Replication Topology */}
        <section className="px-5 pb-8">
          <h3 className="text-white text-lg font-bold font-display mb-4">Topology</h3>
          <StitchCard padding="lg">
            <div className="flex flex-col items-center gap-4">
              <div className="w-full p-4 bg-[#137fec]/10 rounded-lg border border-[#137fec]/30 text-center">
                <StitchIcon name="database" className="text-[#137fec] mx-auto mb-2" />
                <div className="text-white font-bold text-sm">Primary Ledger</div>
                <div className="text-[#94a3b8] text-xs">us-east-1</div>
              </div>
              
              <div className="w-full grid grid-cols-3 gap-2">
                {['us-west-2', 'eu-west-1', 'ap-south-1'].map((region) => (
                  <div key={region} className="p-3 bg-[#0f172a] rounded-lg border border-[#2a3441] text-center">
                    <StitchIcon name="sync" className="text-[#94a3b8] mx-auto mb-1" size="sm" />
                    <div className="text-white text-xs font-medium">{region}</div>
                  </div>
                ))}
              </div>
            </div>
          </StitchCard>
        </section>

        {/* Recent Events */}
        <section className="px-5 pb-8">
          <h3 className="text-white text-lg font-bold font-display mb-3">Recent Events</h3>
          <div className="bg-[#1c252e] rounded-xl border border-[#2a3441] overflow-hidden">
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
