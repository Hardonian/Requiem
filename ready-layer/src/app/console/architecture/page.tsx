'use client';

/**
 * System Architecture Overview
 * 
 * Harvested from Stitch: system_architecture_overview
 * Canonical route: /console/architecture
 * 
 * Features:
 * - Control Plane Topology diagram
 * - System Health metrics
 * - Recent Activity feed
 */

import { 
  StitchHeader, 
  StitchContainer, 
  StitchCard,
  StitchActivityItem,
  StitchIcon,
} from '@/components/stitch';

const systemHealthMetrics = [
  { label: 'Policy Engine', value: '99.9%', status: 'healthy', color: 'bg-green-500' },
  { label: 'Replication', value: '12ms', status: 'healthy', color: 'bg-blue-500' },
];

const recentActivity = [
  {
    id: '1',
    title: 'Policy Update Success',
    description: 'Deployed to 14 nodes',
    timestamp: '2m ago',
    icon: <StitchIcon name="check-circle" className="h-4 w-4" />,
    iconBgClass: 'bg-green-500/10',
    iconColorClass: 'text-green-500',
  },
  {
    id: '2',
    title: 'Replication Lag',
    description: 'us-east-1 region sync delay',
    timestamp: '15m ago',
    icon: <StitchIcon name="warning" className="h-4 w-4" />,
    iconBgClass: 'bg-yellow-500/10',
    iconColorClass: 'text-yellow-500',
  },
  {
    id: '3',
    title: 'Ledger Snapshot',
    description: 'Daily backup completed',
    timestamp: '1h ago',
    icon: <StitchIcon name="info" className="h-4 w-4" />,
    iconBgClass: 'bg-blue-500/10',
    iconColorClass: 'text-blue-500',
  },
];

export default function ArchitecturePage() {
  return (
    <div className="min-h-screen bg-[#101922] flex flex-col overflow-x-hidden">
      {/* Header with back button */}
      <header className="sticky top-0 z-50 bg-[#101922]/95 backdrop-blur-md border-b border-[#2a3441]">
        <div className="flex items-center justify-between px-4 py-3">
          <button 
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#1c252e] transition-colors"
            aria-label="Go back"
          >
            <StitchIcon name="arrow-back" className="text-white" />
          </button>
          <h1 className="text-lg font-bold tracking-tight text-center flex-1 text-white font-display">
            System Architecture
          </h1>
          <button 
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#1c252e] transition-colors"
            aria-label="Documentation"
          >
            <StitchIcon name="article" className="text-[#137fec]" />
          </button>
        </div>
      </header>
      
      <StitchContainer maxWidth="md">
        {/* Intro Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2 text-white font-display">Control Plane Topology</h2>
          <p className="text-sm text-[#94a3b8] leading-relaxed">
            Visualizing high-level data flow and enforcement chokepoints within the infrastructure.
          </p>
        </div>

        {/* Diagram Container */}
        <div className="relative bg-[#1c252e] rounded-xl border border-[#2a3441] p-6 shadow-sm mb-6">
          {/* Connection Lines Layer (Absolute) */}
          <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
            <svg height="100%" width="100%">
              <line x1="50%" y1="12%" x2="50%" y2="22%" stroke="currentColor" strokeWidth="2" className="text-[#94a3b8]" />
              <line x1="50%" y1="38%" x2="50%" y2="48%" stroke="currentColor" strokeWidth="2" className="text-[#94a3b8]" />
              <line x1="50%" y1="64%" x2="30%" y2="78%" stroke="currentColor" strokeWidth="2" className="text-[#94a3b8]" />
              <line x1="50%" y1="64%" x2="70%" y2="78%" stroke="currentColor" strokeWidth="2" className="text-[#94a3b8]" />
            </svg>
          </div>
          
          {/* Flow Diagram */}
          <div className="relative z-10 flex flex-col items-center gap-6">
            {/* CLI Node */}
            <div className="flex flex-col items-center">
              <div className="w-32 h-12 bg-[#0f172a] rounded-lg flex items-center justify-center border border-[#2a3441] shadow-sm">
                <span className="text-xs font-semibold uppercase tracking-wider text-white">CLI / API</span>
              </div>
            </div>
            
            {/* Down Arrow */}
            <div className="text-[#94a3b8]">
              <StitchIcon name="arrow-down" />
            </div>
            
            {/* Policy Engine (Choke Point) */}
            <div className="flex flex-col items-center w-full">
              <div className="w-full p-4 bg-[#137fec]/10 rounded-xl border border-[#137fec]/30 flex flex-col items-center text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-1">
                  <StitchIcon name="shield" className="text-[#137fec]" size="sm" />
                </div>
                <h3 className="text-[#137fec] font-bold text-sm mb-1 font-display">Policy Engine</h3>
                <p className="text-[10px] text-[#94a3b8]">Single Choke Point Enforcement</p>
              </div>
            </div>
            
            {/* Down Arrow */}
            <div className="text-[#94a3b8]">
              <StitchIcon name="arrow-down" />
            </div>
            
            {/* Arbitration Layer */}
            <div className="w-full flex justify-between gap-2">
              <div className="flex-1 p-3 bg-[#1c252e] rounded-lg border border-[#2a3441] flex flex-col items-center justify-center text-center shadow-sm">
                <StitchIcon name="gavel" className="text-[#94a3b8] mb-1" size="sm" />
                <span className="text-xs font-medium text-white">Arbitration</span>
              </div>
              <div className="flex-1 p-3 bg-[#1c252e] rounded-lg border border-[#2a3441] flex flex-col items-center justify-center text-center shadow-sm">
                <StitchIcon name="settings" className="text-[#94a3b8] mb-1" size="sm" />
                <span className="text-xs font-medium text-white">Execution</span>
              </div>
            </div>
            
            {/* Split Flow */}
            <div className="w-full grid grid-cols-2 gap-4 mt-2">
              {/* Storage Column */}
              <div className="flex flex-col gap-3">
                <div className="p-3 bg-[#0f172a]/50 rounded-lg border border-[#2a3441] flex items-center gap-2">
                  <StitchIcon name="database" className="text-purple-500" size="sm" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">SQLite Ledger</span>
                    <span className="text-[10px] text-[#94a3b8]">Immutable Logs</span>
                  </div>
                </div>
                <div className="p-3 bg-[#0f172a]/50 rounded-lg border border-[#2a3441] flex items-center gap-2">
                  <StitchIcon name="folder-zip" className="text-orange-500" size="sm" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">CAS Store</span>
                    <span className="text-[10px] text-[#94a3b8]">Content Addressable</span>
                  </div>
                </div>
              </div>
              
              {/* Security Column */}
              <div className="flex flex-col gap-3">
                <div className="p-3 bg-[#0f172a]/50 rounded-lg border border-[#2a3441] flex items-center gap-2">
                  <StitchIcon name="key" className="text-green-500" size="sm" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">Signing Layer</span>
                    <span className="text-[10px] text-[#94a3b8]">Cryptographic Proof</span>
                  </div>
                </div>
                <div className="p-3 bg-[#0f172a]/50 rounded-lg border border-[#2a3441] flex items-center gap-2">
                  <StitchIcon name="sync" className="text-blue-500" size="sm" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">Replication</span>
                    <span className="text-[10px] text-[#94a3b8]">Stream Sync</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Cards Section */}
        <h3 className="text-lg font-bold mb-3 px-1 text-white font-display">System Health</h3>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {systemHealthMetrics.map((metric) => (
            <StitchCard key={metric.label} padding="md">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${metric.color}`} />
                <span className="text-xs text-[#94a3b8] font-medium">{metric.label}</span>
              </div>
              <div className="text-2xl font-bold text-white font-display">{metric.value}</div>
              <div className="text-xs text-[#94a3b8] mt-1 capitalize">{metric.status}</div>
            </StitchCard>
          ))}
        </div>

        {/* Recent Logs Section */}
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
