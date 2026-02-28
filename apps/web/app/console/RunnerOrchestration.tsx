'use client';

import React from 'react';

export function RunnerOrchestration() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#0d1117] font-sans scrollbar-hide">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[#30363d] bg-[#0d1117]/80 backdrop-blur px-8 py-5">
        <div className="flex flex-col">
          <h2 className="text-lg font-black uppercase tracking-widest text-[#135bec]">Runner Orchestration</h2>
          <p className="text-[#9da6b9] text-[10px] font-bold uppercase tracking-wide">Job scheduling & worker management</p>
        </div>
        <div className="flex items-center gap-4">
          <button type="button" className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Runner
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 md:p-12 max-w-[1600px] mx-auto w-full flex flex-col gap-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           {[
             { label: 'Active Runners', val: '42', trend: 'STABLE', icon: 'settings_input_component', color: 'blue' },
             { label: 'Avg Queue Time', val: '1.2s', trend: '-0.4s', icon: 'timer', color: 'emerald' },
             { label: 'Worker Utilization', val: '68%', trend: 'OPTIMAL', icon: 'rebase_edit', color: 'indigo' },
             { label: 'Job Failure Rate', val: '0.02%', trend: '-0.01%', icon: 'dangerous', color: 'amber' },
           ].map((kpi) => (
             <div key={kpi.label} className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <span className="material-symbols-outlined text-4xl text-white">{kpi.icon}</span>
                </div>
                <p className="text-[#9da6b9] text-[10px] font-black uppercase tracking-widest mb-1">{kpi.label}</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-white tracking-tight">{kpi.val}</h3>
                  <span className={`text-${kpi.color}-400 text-[10px] font-bold uppercase tracking-widest`}>{kpi.trend}</span>
                </div>
                <div className={`absolute bottom-0 left-0 h-1 bg-${kpi.color}-500 w-full opacity-30`}></div>
             </div>
           ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
           <div className="xl:col-span-2 flex flex-col gap-8">
              <div className="bg-[#161b22] border border-[#30363d] rounded-3xl overflow-hidden shadow-2xl">
                 <div className="p-8 border-b border-[#30363d] flex justify-between items-center bg-[#0d1117]/30">
                    <h3 className="text-white font-black text-xs uppercase tracking-widest">Active Executions</h3>
                    <div className="flex gap-2">
                       <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">All Workers Healthy</span>
                    </div>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead className="bg-[#0d1117] text-[10px] font-black uppercase tracking-widest text-slate-500">
                          <tr>
                             <th className="px-8 py-5">Runner ID</th>
                             <th className="px-8 py-5">Status</th>
                             <th className="px-8 py-5">Progress</th>
                             <th className="px-8 py-5 text-right">Throughput</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-[#30363d] text-xs">
                          {[
                            { id: 'runner-0x442', s: 'Running', p: 75, t: '124 req/s', c: 'blue' },
                            { id: 'runner-0x9a1', s: 'Syncing', p: 45, t: '320 req/s', c: 'indigo' },
                            { id: 'runner-0x11b', s: 'Idle', p: 0, t: '0 req/s', c: 'slate' },
                          ].map((r) => (
                            <tr key={r.id} className="hover:bg-white/5 transition-colors">
                               <td className="px-8 py-6">
                                  <div className="flex items-center gap-3">
                                     <div className="w-2 h-2 rounded-full bg-[#135bec] animate-pulse"></div>
                                     <span className="text-white font-bold font-mono tracking-tight">{r.id}</span>
                                  </div>
                               </td>
                               <td className="px-8 py-6">
                                  <span className={`px-2 py-0.5 rounded-full font-black uppercase tracking-widest text-[9px] bg-${r.c}-500/10 text-${r.c}-400 border border-${r.c}-500/20`}>{r.s}</span>
                               </td>
                               <td className="px-8 py-6">
                                  <div className="w-48 bg-slate-800 rounded-full h-1 overflow-hidden">
                                     <div className={`h-full bg-${r.c}-500 transition-all`} style={{ width: `${r.p}%` }}></div>
                                  </div>
                               </td>
                               <td className="px-8 py-6 text-right font-mono text-slate-500">{r.t}</td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>

              <div className="p-10 rounded-3xl border border-dashed border-[#30363d] bg-[#161b22]/30 flex flex-col gap-6">
                 <div>
                    <h4 className="text-white font-black text-sm uppercase tracking-widest">Trigger Manual Runner</h4>
                    <p className="text-[#9da6b9] text-[10px] uppercase font-bold tracking-wide mt-1">Directly invoke an orchestrated worker</p>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="runner-alias" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Alias</label>
                      <input id="runner-alias" className="bg-[#0d1117] border border-[#30363d] rounded-xl px-4 py-3 text-xs text-white outline-none focus:ring-1 focus:ring-[#135bec]" placeholder="Runner Name / Alias"/>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="target-pool" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Target Pool</label>
                      <select id="target-pool" className="bg-[#0d1117] border border-[#30363d] rounded-xl px-4 py-3 text-xs text-white outline-none appearance-none">
                         <option>Target Pool: High-Perf (AWS-1)</option>
                         <option>Target Pool: Standard (GCP-1)</option>
                      </select>
                    </div>
                 </div>
                 <button type="button" className="w-fit px-8 py-3 bg-[#135bec] hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-blue-500/20">Trigger Execution</button>
              </div>
           </div>

           <div className="flex flex-col gap-8">
              <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-8 flex flex-col gap-6">
                 <h3 className="text-white font-black text-xs uppercase tracking-widest">Scheduled Jobs</h3>
                 <div className="space-y-4">
                    {[
                      { name: 'Daily RAG Sync', time: '02:00 UTC', stat: 'ENABLED' },
                      { name: 'Audit Log Bake', time: 'Hourly', stat: 'PAUSED' },
                      { name: 'Model Parity Check', time: '05:00 UTC', stat: 'ENABLED' },
                    ].map((job) => (
                      <div key={job.name} className="flex flex-col gap-2 p-4 rounded-xl bg-[#0d1117] border border-[#30363d] hover:border-[#135bec]/30 transition-all">
                         <div className="flex justify-between items-start">
                            <span className="text-white text-xs font-black uppercase tracking-widest">{job.name}</span>
                            <span className={`text-[9px] font-black uppercase tracking-widest ${job.stat === 'PAUSED' ? 'text-amber-500' : 'text-emerald-500'}`}>{job.stat}</span>
                         </div>
                         <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            <span className="material-symbols-outlined text-sm">schedule</span>
                            <span>{job.time}</span>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="p-8 rounded-2xl bg-[#7f1d1d]/10 border border-red-900/30 flex flex-col gap-6">
                 <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-red-500">dangerous</span>
                    <h3 className="text-white font-black text-xs uppercase tracking-widest">Recent Failures</h3>
                 </div>
                 <div className="space-y-4">
                    {[
                      { id: 'JOB-992', err: 'Worker Timeout', runner: 'runner-alpha-4' },
                      { id: 'JOB-881', err: 'OOM Exception', runner: 'runner-beta-2' },
                    ].map((err) => (
                      <div key={err.id} className="text-[10px] font-bold uppercase tracking-widest">
                         <div className="flex justify-between text-red-400 mb-1">
                            <span>{err.id}</span>
                            <span>{err.err}</span>
                         </div>
                         <div className="text-slate-500 flex justify-between">
                            <span>{err.runner}</span>
                            <span>2m ago</span>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      </main>
    </div>
  );
}
