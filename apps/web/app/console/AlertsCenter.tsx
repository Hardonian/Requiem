'use client';

import React from 'react';

const alerts = [
  { id: 'ALT-001', severity: 'Critical', title: 'Runner memory threshold exceeded', source: 'runner-prod-3', time: '2m ago', status: 'Firing' },
  { id: 'ALT-002', severity: 'High', title: 'Evaluation accuracy dropped below 85%', source: 'eval-engine', time: '14m ago', status: 'Firing' },
  { id: 'ALT-003', severity: 'Medium', title: 'Agent response latency elevated (p95 > 4s)', source: 'agent-cluster', time: '1h ago', status: 'Resolved' },
  { id: 'ALT-004', severity: 'Low', title: 'Unused dataset detected — 30-day retention warning', source: 'dataset-manager', time: '3h ago', status: 'Acknowledged' },
  { id: 'ALT-005', severity: 'Critical', title: 'Governance policy conflict on merge', source: 'governance-engine', time: '5h ago', status: 'Resolved' },
];

const severityColor: Record<string, string> = {
  Critical: 'red',
  High: 'orange',
  Medium: 'amber',
  Low: 'blue',
};

const statusColor: Record<string, string> = {
  Firing: 'red',
  Resolved: 'emerald',
  Acknowledged: 'amber',
};

export function AlertsCenter() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#101622] font-sans">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[#282e39] bg-[#111318] px-10 py-5">
        <div className="flex flex-col">
          <h2 className="text-lg font-black uppercase tracking-widest text-[#135bec]">Alerts</h2>
          <p className="text-[#9da6b9] text-[10px] font-bold uppercase tracking-wide">System health events & threshold violations</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="flex items-center gap-2 bg-[#1e293b] border border-slate-700/50 text-[#9da6b9] px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest hover:text-white transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            Rules
          </button>
          <button
            type="button"
            className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20"
          >
            <span className="material-symbols-outlined text-[18px]">add_alert</span>
            New Rule
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 md:p-12 max-w-[1600px] mx-auto w-full flex flex-col gap-10">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Firing', value: '2', color: 'red' },
            { label: 'Acknowledged', value: '1', color: 'amber' },
            { label: 'Resolved (24h)', value: '12', color: 'emerald' },
            { label: 'Active Rules', value: '34', color: 'blue' },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#1e293b] rounded-2xl border border-slate-700/50 p-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#9da6b9] mb-2">{stat.label}</p>
              <p className={`text-3xl font-black text-${stat.color}-400`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Alert Feed */}
        <div>
          <h3 className="text-white font-black text-xs uppercase tracking-widest mb-6">Alert Feed</h3>
          <div className="flex flex-col gap-3">
            {alerts.map((alert) => {
              const sColor = severityColor[alert.severity] ?? 'slate';
              const stColor = statusColor[alert.status] ?? 'slate';
              return (
                <div
                  key={alert.id}
                  className={`bg-[#1e293b] rounded-2xl border border-slate-700/50 px-6 py-5 flex items-start gap-5 hover:border-[#135bec]/30 transition-all ${alert.status === 'Firing' ? 'border-l-4 border-l-red-500' : ''}`}
                >
                  <div className={`mt-0.5 w-2.5 h-2.5 rounded-full bg-${sColor}-500 shrink-0 ${alert.status === 'Firing' ? 'animate-pulse' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-1.5">
                      <p className="text-white font-bold text-sm truncate">{alert.title}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full font-black uppercase tracking-widest text-[9px] bg-${sColor}-500/10 text-${sColor}-400 border border-${sColor}-500/20`}>
                          {alert.severity}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full font-black uppercase tracking-widest text-[9px] bg-${stColor}-500/10 text-${stColor}-400 border border-${stColor}-500/20`}>
                          {alert.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-[#9da6b9] font-bold uppercase tracking-widest">
                      <span className="font-mono">{alert.id}</span>
                      <span>Source: {alert.source}</span>
                      <span>{alert.time}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {alert.status === 'Firing' && (
                      <button
                        type="button"
                        className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-amber-500/20 transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      type="button"
                      className="px-3 py-1.5 bg-[#111318] border border-slate-700/50 text-[#9da6b9] text-[9px] font-black uppercase tracking-widest rounded-lg hover:text-white transition-colors"
                      aria-label={`View details for ${alert.id}`}
                    >
                      Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
