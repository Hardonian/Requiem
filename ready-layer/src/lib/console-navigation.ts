export interface ConsoleNavEntry {
  href: string;
  baseLabel: string;
  section: 'platform' | 'operations';
  icon: string;
}

export const CONSOLE_NAV_ENTRIES: readonly ConsoleNavEntry[] = [
  { href: '/console/overview', baseLabel: 'Overview', section: 'platform', icon: 'home' },
  { href: '/console/architecture', baseLabel: 'Architecture', section: 'platform', icon: 'architecture' },
  { href: '/console/guarantees', baseLabel: 'Guarantees', section: 'platform', icon: 'guarantees' },
  { href: '/console/replication', baseLabel: 'Replication', section: 'platform', icon: 'replication' },
  { href: '/console/logs', baseLabel: 'Logs', section: 'operations', icon: 'logs' },
  { href: '/console/runs', baseLabel: 'Runs', section: 'operations', icon: 'runs' },
  { href: '/console/plans', baseLabel: 'Plans', section: 'operations', icon: 'plans' },
  { href: '/console/policies', baseLabel: 'Policies', section: 'operations', icon: 'policies' },
  { href: '/console/capabilities', baseLabel: 'Capabilities', section: 'operations', icon: 'capabilities' },
  { href: '/console/finops', baseLabel: 'FinOps', section: 'operations', icon: 'finops' },
  { href: '/console/snapshots', baseLabel: 'Snapshots', section: 'operations', icon: 'snapshots' },
  { href: '/registry', baseLabel: 'Registry', section: 'operations', icon: 'registry' },
  { href: '/spend', baseLabel: 'Spend', section: 'operations', icon: 'spend' },
  { href: '/drift', baseLabel: 'Drift', section: 'operations', icon: 'drift' },
  { href: '/settings', baseLabel: 'Settings', section: 'operations', icon: 'settings' },
] as const;
