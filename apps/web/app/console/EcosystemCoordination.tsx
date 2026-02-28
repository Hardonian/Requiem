'use client';

import React from 'react';

export function EcosystemCoordination() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#101622] font-sans scrollbar-hide">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[#282e39] bg-[#111318] px-10 py-5">
        <div className="flex flex-col">
          <h2 className="text-white text-lg font-black uppercase tracking-widest text-[#135bec]">Ecosystem Coordination</h2>
          <p className="text-[#9da6b9] text-[10px] font-bold uppercase tracking-wide">Multi-repo health & global synchronization</p>
        </div>
        <div className="flex items-center gap-4">
          <button type="button" className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20">
            <span className="material-symbols-outlined text-[18px]">sync</span>
            Sync Agents
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 md:p-12 max-w-[1600px] mx-auto w-full flex flex-col gap-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
           {[
             { name: 'ReadyLayer Core', ver: 'v2.4.0', status: 'Online', uptime: '99.99%', lat: '12ms', color: 'emerald' },
             { name: 'Settler Engine', ver: 'v1.8.2', status: 'Online', uptime: '99.95%', lat: '24ms', color: 'emerald' },
             { name: 'Zeo Interface', ver: 'v0.9.1-rc', status: 'Syncing', uptime: '45%', lat: '45ms', color: 'blue', sync: true },
             { name: 'AIAS Network', ver: 'v3.0.0', status: 'Maintenance', uptime: '99.00%', lat: '2m rem', color: 'amber' },
           ].map((node) => (
             <div key={node.name} className={`flex flex-col p-6 bg-[#1e293b] rounded-2xl border border-slate-700/50 shadow-xl relative overflow-hidden group ${node.name === 'AIAS Network' ? 'border-l-4 border-l-amber-500' : ''}`}>
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-2">
                    <div className={`size-2 rounded-full bg-${node.color}-500 ${node.sync ? 'animate-pulse' : ''} shadow-[0_0_8px_rgba(59,130,246,0.6)]`}></div>
                    <span className="text-xs font-black text-white uppercase tracking-widest">{node.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 bg-[#111318] px-2 py-0.5 rounded border border-white/5">{node.ver}</span>
                </div>
                <div className="mt-auto">
                   <h3 className="text-2xl font-black text-white tracking-tight mb-2 uppercase">{node.status}</h3>
                   {node.sync ? (
                      <div className="w-full bg-slate-800 rounded-full h-1 my-3 overflow-hidden">
                        <div className="bg-blue-500 h-1 rounded-full animate-progress" style={{ width: node.uptime }}></div>
                      </div>
                   ) : (
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-[#9da6b9]">
                        <span className={`text-${node.color}-400`}>{node.uptime}</span>
                        <span>{node.lat}</span>
                      </div>
                   )}
                </div>
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <span className="material-symbols-outlined text-5xl">hub</span>
                </div>
             </div>
           ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
           <div className="lg:col-span-2 bg-[#1e293b] rounded-3xl border border-slate-700/50 shadow-2xl flex flex-col overflow-hidden">
              <div className="p-6 border-b border-slate-700/50 flex justify-between items-center bg-[#111318]/30">
                 <h3 className="text-white font-black text-xs uppercase tracking-widest">Cross-Repo Dependency Graph</h3>
                 <div className="flex gap-2">
                    <button type="button" aria-label="Fit to screen" className="p-2 rounded bg-slate-800 text-slate-400 hover:text-white"><span className="material-symbols-outlined text-sm">fit_screen</span></button>
                 </div>
              </div>
              <div className="relative flex-1 bg-[#151b26] flex items-center justify-center min-h-[400px]">
                 <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                 {/* Visual Mockup for Graph */}
                 <div className="relative w-full h-full max-w-lg">
                    <div className="absolute top-[10%] left-1/2 -translate-x-1/2 flex flex-col items-center">
                       <div className="w-16 h-16 rounded-full border-2 border-emerald-500 bg-slate-900 flex items-center justify-center text-emerald-500 shadow-2xl">
                          <span className="material-symbols-outlined text-3xl">hub</span>
                       </div>
                       <span className="mt-2 text-[10px] font-black uppercase tracking-widest text-white bg-slate-800 px-3 py-1 rounded-full border border-white/10">ReadyLayer Core</span>
                    </div>
                    <div className="absolute top-[60%] left-[10%] flex flex-col items-center">
                       <div className="w-12 h-12 rounded-full border-2 border-emerald-500 bg-slate-900 flex items-center justify-center text-emerald-500 shadow-xl">
                          <span className="material-symbols-outlined">settings_input_component</span>
                       </div>
                       <span className="mt-2 text-[9px] font-black uppercase tracking-widest text-[#9da6b9]">Settler</span>
                    </div>
                    <div className="absolute top-[60%] right-[10%] flex flex-col items-center">
                       <div className="w-12 h-12 rounded-full border-2 border-blue-500 bg-slate-900 flex items-center justify-center text-blue-500 shadow-xl animate-pulse">
                          <span className="material-symbols-outlined">api</span>
                       </div>
                       <span className="mt-2 text-[9px] font-black uppercase tracking-widest text-[#9da6b9]">Zeo</span>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-[#1e293b] rounded-3xl border border-slate-700/50 shadow-2xl flex flex-col">
              <div className="p-6 border-b border-slate-700/50 bg-[#111318]/30">
                 <h3 className="text-white font-black text-xs uppercase tracking-widest">Version Sync Status</h3>
                 <p className="text-[#9da6b9] text-[10px] uppercase font-bold tracking-wide mt-1">checking agents.md & parity</p>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-800">
                 <div className="p-6 hover:bg-white/5 transition-colors">
                    <div className="flex items-start gap-3">
                       <div className="p-1 bg-emerald-500/10 text-emerald-500 rounded-full">
                          <span className="material-symbols-outlined text-sm">check</span>
                       </div>
                       <div className="flex-1">
                          <div className="flex justify-between font-black text-[10px] uppercase tracking-widest mb-1">
                             <span className="text-white">Agents.md Parity</span>
                             <span className="text-slate-500">v2.4.0</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3">Core &lt;&gt; Settler</p>
                          <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                             <div className="bg-emerald-500 h-1 w-full"></div>
                          </div>
                       </div>
                    </div>
                 </div>
                 <div className="p-6 bg-red-500/5 hover:bg-red-500/10 transition-colors border-l-4 border-l-red-500">
                    <div className="flex items-start gap-3">
                       <div className="p-1 bg-red-500/10 text-red-500 rounded-full">
                          <span className="material-symbols-outlined text-sm">priority_high</span>
                       </div>
                       <div className="flex-1">
                          <div className="flex justify-between font-black text-[10px] uppercase tracking-widest mb-1">
                             <span className="text-white">Config Mismatch</span>
                             <span className="text-red-500">Critical</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3">Zeo &lt;&gt; AIAS</p>
                          <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 font-mono text-[9px] text-[#9da6b9]">
                             <pre className="text-red-400">-"timeout": 5000</pre>
                             <pre className="text-emerald-400">+"timeout": 10000</pre>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
              <div className="p-6 bg-[#111318]/30 border-t border-slate-700/50">
                 <button type="button" className="w-full py-3 bg-[#1c2333] border border-slate-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all">View Full Parity Report</button>
              </div>
           </div>
        </div>

        <div className="mb-12">
            <h3 className="text-white font-black text-xs uppercase tracking-widest mb-6">Recent Orchestration Actions</h3>
            <div className="bg-[#1e293b] rounded-2xl border border-slate-700/50 overflow-hidden shadow-2xl">
               <table className="w-full text-left font-sans">
                  <thead className="bg-[#111318] text-[10px] font-black uppercase tracking-widest text-slate-500">
                     <tr>
                        <th className="px-8 py-4">Action</th>
                        <th className="px-8 py-4">Target</th>
                        <th className="px-8 py-4">Status</th>
                        <th className="px-8 py-4 text-right">Timestamp</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-xs">
                     {[
                       { a: 'Manual Sync', t: 'Zeo Interface', s: 'Completed', c: 'emerald' },
                       { a: 'Schema Rollback', t: 'AIAS Network', s: 'Pending', c: 'amber' },
                       { a: 'Config Update', t: 'ReadyLayer Core', s: 'Completed', c: 'emerald' },
                     ].map((log, i) => (
                       <tr key={i} className="hover:bg-white/5 transition-colors">
                          <td className="px-8 py-5 font-bold text-white uppercase tracking-wide">{log.a}</td>
                          <td className="px-8 py-5 text-[#9da6b9] font-medium uppercase tracking-widest text-[10px]">{log.t}</td>
                          <td className="px-8 py-5">
                             <span className={`px-2 py-0.5 rounded-full font-black uppercase tracking-widest text-[9px] bg-${log.c}-500/10 text-${log.c}-400 border border-${log.c}-500/20`}>{log.s}</span>
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
