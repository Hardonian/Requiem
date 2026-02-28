import React from 'react';
import { HealthData } from '@/lib/viewmodels/health';
import { AgentData } from '@/lib/viewmodels/agents';

interface MissionControlOverviewProps {
  health: HealthData;
  agents: AgentData;
}

export function MissionControlOverview({ health, agents }: MissionControlOverviewProps) {
  return (
    <div className="p-6 lg:px-10 lg:py-8 max-w-[1600px] mx-auto w-full flex flex-col gap-6">
      {/* Alerts Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 dark:text-yellow-400 relative overflow-hidden group">
        <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
        <div className="flex items-start gap-3 relative z-10">
          <span className="material-symbols-outlined text-yellow-600 dark:text-yellow-500 mt-0.5">warning</span>
          <div>
            <h3 className="text-sm font-bold text-yellow-700 dark:text-yellow-400">Degraded Mode Active</h3>
            <p className="text-sm text-yellow-700/80 dark:text-yellow-400/80 mt-0.5">High latency detected in Zeo submodule. Orchestration throughput is limited.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0 relative z-10">
          <button type="button" className="px-4 py-1.5 rounded-md bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 text-sm font-semibold transition-colors w-full sm:w-auto border border-yellow-500/20">
            Investigate
          </button>
          <button type="button" className="p-1.5 rounded-md hover:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 transition-colors">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
      </div>

      {/* System Health Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="p-5 rounded-lg bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-[#2e3545] shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">System Uptime (24h)</span>
            <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-[20px]">activity_zone</span>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{health.uptime}</span>
            <span className="flex items-center text-emerald-600 dark:text-emerald-400 text-sm font-semibold mb-1 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              <span className="material-symbols-outlined text-[16px] mr-0.5">trending_up</span>
              {health.uptimeTrend}
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${health.uptime}` }}></div>
          </div>
        </div>
        {/* Metric 2 */}
        <div className="p-5 rounded-lg bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-[#2e3545] shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Queue Depth</span>
            <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-[20px]">layers</span>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{health.queueDepth}</span>
            <span className="flex items-center text-amber-600 dark:text-amber-400 text-sm font-semibold mb-1 bg-amber-500/10 px-1.5 py-0.5 rounded">
              <span className="material-symbols-outlined text-[16px] mr-0.5">trending_up</span>
              {health.queueTrend}
            </span>
          </div>
          <div className="mt-3 flex gap-1 h-1.5 w-full">
            <div className="h-full bg-emerald-500 rounded-full w-[60%] opacity-50"></div>
            <div className="h-full bg-amber-500 rounded-full w-[30%]"></div>
            <div className="h-full bg-slate-800 rounded-full w-[10%] opacity-30"></div>
          </div>
        </div>
        {/* Metric 3 */}
        <div className="p-5 rounded-lg bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-[#2e3545] shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Failure Rate</span>
            <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-[20px]">error_med</span>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{health.failureRate}</span>
            <span className="flex items-center text-emerald-600 dark:text-emerald-400 text-sm font-semibold mb-1 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              <span className="material-symbols-outlined text-[16px] mr-0.5">trending_down</span>
              {health.failureTrend}
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-red-500 rounded-full" style={{ width: `${health.failureRate}` }}></div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Active Runs Table */}
        <div className="lg:col-span-2 flex flex-col bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-[#2e3545] rounded-lg shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#2e3545]">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Active Runs
              <span className="px-2 py-0.5 rounded-full bg-[#135bec]/10 text-[#135bec] text-xs font-bold">Live</span>
            </h3>
            <div className="flex gap-2">
              <button type="button" className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <span className="material-symbols-outlined text-[20px]">filter_list</span>
              </button>
              <button type="button" className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <span className="material-symbols-outlined text-[20px]">refresh</span>
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium">
                <tr>
                  <th className="px-6 py-3">Trace ID</th>
                  <th className="px-6 py-3">Agent</th>
                  <th className="px-6 py-3">Repo</th>
                  <th className="px-6 py-3">Runtime</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2e3545] text-slate-600 dark:text-slate-300">
                {agents.activeRuns.map((run) => (
                  <tr key={run.traceId} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-3.5 font-mono text-[#135bec] group-hover:underline cursor-pointer">{run.traceId}</td>
                    <td className="px-6 py-3.5 font-medium text-slate-900 dark:text-white">{run.agentName}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-slate-400">folder</span>
                        {run.repo}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 font-mono">{run.runtime}</td>
                    <td className="px-6 py-3.5">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        run.status === 'Running' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                        run.status === 'Stalled' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                        run.status === 'Error' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' :
                        'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
                      }`}>
                        {run.status === 'Running' && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                        )}
                        {run.status !== 'Running' && (
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            run.status === 'Stalled' ? 'bg-amber-500' :
                            run.status === 'Error' ? 'bg-red-500' :
                            'bg-slate-500'
                          }`}></span>
                        )}
                        {run.status}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button type="button" className="text-slate-400 hover:text-red-500 transition-colors" title="Abort Run">
                        <span className="material-symbols-outlined text-[20px]">stop_circle</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-slate-200 dark:border-[#2e3545] flex justify-center">
            <button type="button" className="text-sm font-medium text-slate-500 hover:text-[#135bec] dark:text-slate-400 dark:hover:text-white transition-colors flex items-center gap-1">
              View All Active Runs
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* Right Column: Stats & Status */}
        <div className="flex flex-col gap-6">
          {/* Eval Drift */}
          <div className="p-5 bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-[#2e3545] rounded-lg shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Eval Drift</h3>
              <span className="text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded">24h</span>
            </div>
            <div className="flex items-end gap-2 mb-4">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">0.15</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 mb-1">Model Drift Score</span>
            </div>
            {/* Sparkline approximation */}
            <div aria-label="Sparkline showing drift over time" className="h-24 w-full flex items-end gap-1 overflow-hidden">
              {[20, 30, 25, 40, 35, 45, 60, 50, 55, 70, 80, 75].map((h, i) => (
                <div 
                  key={i} 
                  className={`flex-1 bg-[#135bec]/20 hover:bg-[#135bec]/40 transition-colors rounded-t-xs`} 
                  style={{ height: `${h}%` }}
                ></div>
              ))}
            </div>
          </div>

          {/* Repo Health Matrix */}
          <div className="p-5 bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-[#2e3545] rounded-lg shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Repo Health Matrix</h3>
              <button type="button" className="text-xs text-[#135bec] hover:underline">View Details</button>
            </div>
            <div className="flex flex-col gap-3">
              {[
                { name: 'ReadyLayer', status: 'Online', color: 'emerald' },
                { name: 'Settler', status: 'Online', color: 'emerald' },
                { name: 'Zeo', status: 'Latency Warning', color: 'amber', animate: true },
                { name: 'AIAS', status: 'Offline', color: 'red' },
              ].map((repo) => (
                <div key={repo.name} className={`group flex items-center justify-between p-3 rounded-lg border transition-all cursor-default ${
                  repo.color === 'emerald' ? 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30' :
                  repo.color === 'amber' ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10' :
                  'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10'
                }`}>
                  <div className="flex items-center gap-3">
                    {repo.animate ? (
                      <div className="relative size-2">
                        <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></div>
                        <div className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></div>
                      </div>
                    ) : (
                      <div className={`size-2 rounded-full bg-${repo.color}-500 shadow-[0_0_8px_rgba(var(--${repo.color}-500-rgb),0.4)]`}></div>
                    )}
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{repo.name}</span>
                  </div>
                  <span className={`text-xs font-medium text-${repo.color}-600 dark:text-${repo.color}-400`}>{repo.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
