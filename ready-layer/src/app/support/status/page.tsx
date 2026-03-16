import type { Metadata } from 'next';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'System Status | Requiem',
  description: 'Current system status and availability for Requiem services.',
};

const services = [
  { name: 'API', status: 'operational', description: 'Core API endpoints' },
  { name: 'CLI', status: 'operational', description: 'Command-line tools' },
  { name: 'Dashboard', status: 'operational', description: 'Web dashboard' },
  { name: 'Replay Engine', status: 'operational', description: 'Deterministic replay system' },
  { name: 'Policy Engine', status: 'operational', description: 'Policy evaluation service' },
];

export default function SupportStatusPage() {
  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wide text-muted">System Status</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl font-display">
          Service availability
        </h1>
      </section>

      <div className="mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6 space-y-6">
        <section className="rounded-xl border border-border bg-surface p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-3 h-3 bg-success rounded-full" aria-hidden="true" />
            <span className="text-xl font-semibold text-foreground">All Systems Operational</span>
          </div>

          <div className="space-y-1">
            {services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between py-3 border-b border-border last:border-0"
              >
                <div>
                  <h3 className="font-medium text-foreground">{service.name}</h3>
                  <p className="text-sm text-muted">{service.description}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    service.status === 'operational'
                      ? 'bg-success/10 text-success border-success/20'
                      : 'bg-destructive/10 text-destructive border-destructive/20'
                  }`}
                >
                  {service.status}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-8">
          <h2 className="text-xl font-semibold text-foreground mb-4 font-display">Recent Incidents</h2>
          <p className="text-muted">No recent incidents to report.</p>
        </section>
      </div>
    </MarketingShell>
  );
}
