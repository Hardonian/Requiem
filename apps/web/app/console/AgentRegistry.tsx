'use client';

import React from 'react';
import { AgentTable, AgentEntry } from '../panels/AgentTable';

export function AgentRegistry() {
  const agents: AgentEntry[] = [
    { id: '1', name: 'finance-analyst-v2', org: 'Finance Org', repo: 'github/fin-bot', version: 'v2.4.1', capabilities: ['SQL', 'RAG', 'Python'], health: 'Healthy', errorRate: '0.02%', lastRun: '2m ago', lastRunId: '#8a2b9c1', isEnabled: true, icon: 'account_balance', iconColor: 'indigo' },
    { id: '2', name: 'support-triage-bot', org: 'Customer Success', repo: 'github/cs-bot', version: 'v1.0.9', capabilities: ['Classification', 'Jira'], health: 'Degraded', errorRate: '1.45%', lastRun: '12s ago', lastRunId: '#1f9d3x8', isEnabled: true, icon: 'support_agent', iconColor: 'purple' },
    { id: '3', name: 'research-summarizer-beta', org: 'R&D Lab', repo: 'github/rd-sum', version: 'v0.5.0-beta', capabilities: ['NLP', 'Python'], health: 'Offline', errorRate: '0.00%', lastRun: '2d ago', lastRunId: '#------', isEnabled: false, icon: 'science', iconColor: 'slate' },
    { id: '4', name: 'sec-monitor-v1', org: 'Infra Sec', repo: 'github/sec-mon', version: 'v1.2.0', capabilities: ['Audit', 'Logs'], health: 'Critical', errorRate: '12.5%', lastRun: '5m ago', lastRunId: '#9c2d1b4', isEnabled: true, icon: 'security', iconColor: 'rose' },
    { id: '5', name: 'ecom-rec-engine', org: 'Sales Org', repo: 'github/rec-sys', version: 'v3.0.1', capabilities: ['Vector DB', 'Search'], health: 'Healthy', errorRate: '0.00%', lastRun: '45s ago', lastRunId: '#3f8a1c9', isEnabled: true, icon: 'shopping_cart', iconColor: 'teal' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[#101622] relative">
      <header className="shrink-0 border-b border-slate-800 bg-[#111318]/50 backdrop-blur-md z-10">
        <div className="px-6 py-4 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm">
            <a className="text-slate-400 hover:text-slate-200" href="#">ReadyLayer</a>
            <span className="text-slate-600">/</span>
            <a className="text-slate-400 hover:text-slate-200" href="#">Console</a>
            <span className="text-slate-600">/</span>
            <span className="text-white font-medium">Agents</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Agent Registry</h1>
              <p className="text-slate-400 text-sm mt-1">Manage lifecycle, capabilities, and health status across your organization.</p>
            </div>
            <div className="flex gap-3">
              <button type="button" className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-sm font-medium hover:bg-slate-700 hover:border-slate-600 transition-all">
                <span className="material-symbols-outlined text-[20px]">file_upload</span>
                Import Config
              </button>
              <button type="button" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#135bec] hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-900/20 transition-all">
                <span className="material-symbols-outlined text-[20px]">add</span>
                Register New Agent
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
            {[
              { label: 'Total Agents', value: '124', trend: '12%', color: 'emerald' },
              { label: 'Active Instances', value: '118', trend: '5%', color: 'emerald' },
              { label: 'Healthy', value: '112', sub: '90.3% Uptime' },
              { label: 'High Error Rate (>1%)', value: '6', trend: '-2%', color: 'rose' },
            ].map((stat) => (
              <div key={stat.label} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 flex flex-col">
                <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">{stat.label}</span>
                <div className="flex items-end justify-between mt-1">
                  <span className="text-2xl font-bold text-white">{stat.value}</span>
                  {stat.trend && (
                    <span className={`text-${stat.color}-400 text-xs font-medium bg-${stat.color}-400/10 px-1.5 py-0.5 rounded flex items-center gap-1`}>
                      <span className="material-symbols-outlined text-[14px]">{stat.color === 'emerald' ? 'trending_up' : 'trending_down'}</span> {stat.trend}
                    </span>
                  )}
                  {stat.sub && <span className="text-slate-400 text-xs">{stat.sub}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 pt-2">
        <div className="sticky top-0 z-10 bg-[#101622] pb-4 pt-2">
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
            <div className="relative w-full lg:w-96 group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-slate-500 group-focus-within:text-[#135bec] transition-colors">search</span>
              </div>
              <input className="block w-full pl-10 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#135bec] focus:border-[#135bec] sm:text-sm" placeholder="Search by name, ID, or capability..." type="text"/>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              {['All Organizations', 'All Capabilities', 'Status: Any'].map((opt) => (
                <select key={opt} aria-label={opt} className="bg-slate-800 border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-[#135bec] focus:border-[#135bec] py-2 pl-3 pr-8 outline-none">
                  <option>{opt}</option>
                </select>
              ))}
              <div className="h-6 w-px bg-slate-700 mx-1 hidden lg:block"></div>
              <button type="button" className="text-slate-400 hover:text-white p-2 rounded hover:bg-slate-800 transition-colors">
                <span className="material-symbols-outlined text-[20px]">grid_view</span>
              </button>
              <button type="button" className="text-[#135bec] bg-[#135bec]/10 p-2 rounded transition-colors">
                <span className="material-symbols-outlined text-[20px]">view_list</span>
              </button>
            </div>
          </div>
        </div>

        <AgentTable agents={agents} />
        
        <div className="mt-6 flex items-center justify-between">
           <p className="text-sm text-slate-400">
             Showing <span className="font-medium text-white">1</span> to <span className="font-medium text-white">5</span> of <span className="font-medium text-white">124</span> results
           </p>
           <nav className="inline-flex rounded-md shadow-sm -space-x-px">
             <button type="button" className="px-2 py-2 rounded-l-md border border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors">
               <span className="material-symbols-outlined text-[20px]">chevron_left</span>
             </button>
             <button type="button" className="px-4 py-2 bg-[#135bec]/20 border border-[#135bec] text-[#135bec] text-sm font-medium">1</button>
             <button type="button" className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 text-sm font-medium transition-colors">2</button>
             <button type="button" className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 text-sm font-medium transition-colors">3</button>
             <span className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-400 text-sm">...</span>
             <button type="button" className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 text-sm font-medium transition-colors">8</button>
             <button type="button" className="px-2 py-2 rounded-r-md border border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors">
               <span className="material-symbols-outlined text-[20px]">chevron_right</span>
             </button>
           </nav>
        </div>
      </div>
    </div>
  );
}
