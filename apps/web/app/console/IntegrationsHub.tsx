'use client';

import React from 'react';

const integrations = [
  { name: 'GitHub', status: 'Connected', category: 'Source Control', icon: 'code', color: 'emerald', desc: 'Repository sync & CI/CD triggers' },
  { name: 'Slack', status: 'Connected', category: 'Notifications', icon: 'forum', color: 'emerald', desc: 'Alert routing & incident channels' },
  { name: 'Datadog', status: 'Pending', category: 'Observability', icon: 'analytics', color: 'amber', desc: 'Metrics forwarding & APM traces' },
  { name: 'PagerDuty', status: 'Disconnected', category: 'Incident Management', icon: 'warning', color: 'slate', desc: 'On-call escalation policies' },
  { name: 'Snowflake', status: 'Connected', category: 'Data Warehouse', icon: 'dataset', color: 'emerald', desc: 'Training data export pipelines' },
  { name: 'Jira', status: 'Disconnected', category: 'Project Tracking', icon: 'task', color: 'slate', desc: 'Issue creation from alerts' },
];

const statusColor: Record<string, string> = {
  Connected: 'emerald',
  Pending: 'amber',
  Disconnected: 'slate',
};

export function IntegrationsHub() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#101622] font-sans">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[#282e39] bg-[#111318] px-10 py-5">
        <div className="flex flex-col">
          <h2 className="text-lg font-black uppercase tracking-widest text-[#135bec]">Integrations</h2>
          <p className="text-[#9da6b9] text-[10px] font-bold uppercase tracking-wide">Third-party connections & webhook endpoints</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Integration
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 md:p-12 max-w-[1600px] mx-auto w-full flex flex-col gap-10">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Active', value: '3', color: 'emerald' },
            { label: 'Pending Auth', value: '1', color: 'amber' },
            { label: 'Disconnected', value: '2', color: 'slate' },
            { label: 'Webhooks Fired (24h)', value: '1,284', color: 'blue' },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#1e293b] rounded-2xl border border-slate-700/50 p-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#9da6b9] mb-2">{stat.label}</p>
              <p className={`text-3xl font-black text-${stat.color}-400`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Integration Cards */}
        <div>
          <h3 className="text-white font-black text-xs uppercase tracking-widest mb-6">Available Integrations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {integrations.map((integration) => {
              const color = statusColor[integration.status] ?? 'slate';
              return (
                <div
                  key={integration.name}
                  className="bg-[#1e293b] rounded-2xl border border-slate-700/50 p-6 flex flex-col gap-4 hover:border-[#135bec]/40 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#111318] border border-slate-700/50 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[#9da6b9] text-[20px]">{integration.icon}</span>
                      </div>
                      <div>
                        <p className="text-white font-black text-sm">{integration.name}</p>
                        <p className="text-[10px] text-[#9da6b9] font-bold uppercase tracking-widest">{integration.category}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full font-black uppercase tracking-widest text-[9px] bg-${color}-500/10 text-${color}-400 border border-${color}-500/20`}>
                      {integration.status}
                    </span>
                  </div>
                  <p className="text-[#9da6b9] text-xs">{integration.desc}</p>
                  <div className="mt-auto pt-2 border-t border-slate-700/50 flex justify-end">
                    <button
                      type="button"
                      className="text-[10px] font-black uppercase tracking-widest text-[#135bec] hover:text-blue-400 transition-colors"
                    >
                      {integration.status === 'Connected' ? 'Configure' : 'Connect'} →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Webhook Log */}
        <div>
          <h3 className="text-white font-black text-xs uppercase tracking-widest mb-6">Recent Webhook Events</h3>
          <div className="bg-[#1e293b] rounded-2xl border border-slate-700/50 overflow-hidden">
            <table className="w-full text-left font-sans">
              <thead className="bg-[#111318] text-[10px] font-black uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-8 py-4">Source</th>
                  <th className="px-8 py-4">Event</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {[
                  { src: 'GitHub', ev: 'push.main', status: '200 OK', color: 'emerald' },
                  { src: 'Slack', ev: 'command.trigger', status: '200 OK', color: 'emerald' },
                  { src: 'Datadog', ev: 'alert.triggered', status: '202 Accepted', color: 'amber' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="px-8 py-5 font-bold text-white uppercase tracking-wide">{row.src}</td>
                    <td className="px-8 py-5 font-mono text-[#9da6b9] text-[11px]">{row.ev}</td>
                    <td className="px-8 py-5">
                      <span className={`px-2 py-0.5 rounded-full font-black uppercase tracking-widest text-[9px] bg-${row.color}-500/10 text-${row.color}-400 border border-${row.color}-500/20`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right font-mono text-slate-500">10:42 AM</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
