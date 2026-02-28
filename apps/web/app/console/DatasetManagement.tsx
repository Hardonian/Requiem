'use client';

import React from 'react';

export function DatasetManagement() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#101622] font-sans">
      <header className="h-16 border-b border-[#3b4354] bg-[#111318] flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-[#9da6b9] text-sm font-medium">Console</span>
          <span className="material-symbols-outlined text-[#9da6b9] text-[16px]">chevron_right</span>
          <span className="text-white text-sm font-medium">Datasets & RAG</span>
        </div>
        <div className="flex items-center gap-4">
          <button type="button" className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#3b4354] bg-[#1c1f27] text-white text-sm font-medium hover:bg-[#282e39] transition-colors">
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            <span>Sync All</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 scrollbar-hide">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-8">
          <div className="flex flex-wrap justify-between items-end gap-4">
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight mb-2 uppercase">Dataset & RAG Management</h1>
              <p className="text-[#9da6b9] text-base max-w-2xl">Manage vector stores, configure ingestion pipelines, and test retrieval accuracy for your agentic workflows.</p>
            </div>
            <button type="button" className="flex items-center gap-2 px-6 py-3 bg-[#135bec] hover:bg-blue-600 text-white rounded-lg font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-500/20 transition-all">
              <span className="material-symbols-outlined text-[20px]">add</span>
              Add Data Source
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Index Status', val: 'Healthy', icon: 'health_metrics', color: 'emerald' },
              { label: 'Total Vector Count', val: '1,240,500', icon: 'library_books', color: 'blue' },
              { label: 'Avg Retrieval Latency', val: '24ms', icon: 'speed', color: 'indigo' },
              { label: 'Sync Lag', val: '< 1 min', icon: 'sync', color: 'teal' },
            ].map((stat) => (
              <div key={stat.label} className="bg-[#1c1f27] border border-[#3b4354] rounded-xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <span className="material-symbols-outlined text-6xl text-white">{stat.icon}</span>
                </div>
                <p className="text-[#9da6b9] text-[10px] font-bold uppercase tracking-widest mb-1">{stat.label}</p>
                <div className="flex items-center gap-2">
                   <h3 className="text-2xl font-black text-white">{stat.val}</h3>
                   {stat.label === 'Index Status' && <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>}
                </div>
                <div className={`absolute bottom-0 left-0 h-1 bg-${stat.color}-500 w-full opacity-30`}></div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-12">
            <div className="xl:col-span-2 flex flex-col gap-6">
               <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-white uppercase tracking-widest">Active Datasets</h2>
                  <div className="flex gap-2">
                     <div className="relative group">
                        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9da6b9] text-[18px] group-focus-within:text-[#135bec]">search</span>
                        <input className="bg-[#1c1f27] border border-[#3b4354] text-white text-xs rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-[#135bec] outline-none w-48" placeholder="Search sources..."/>
                     </div>
                  </div>
               </div>
               <div className="bg-[#1c1f27] border border-[#3b4354] rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="bg-[#161920] border-b border-[#3b4354] text-[10px] font-black uppercase tracking-widest text-[#9da6b9]">
                           <th className="px-6 py-4">Source Name</th>
                           <th className="px-6 py-4">Status</th>
                           <th className="px-6 py-4">Chunks</th>
                           <th className="px-6 py-4">Embedding</th>
                           <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-[#3b4354] text-xs">
                        {[
                          { name: 'Stax_Knowledge_Base', type: 'Stax API', status: 'Active', chunks: '520,000', model: 'cohere-v3', color: 'emerald' },
                          { name: 'Customer_Support_Q4.csv', type: 'CSV Upload', status: 'Syncing', chunks: '14,200', model: 'text-3', color: 'amber', anim: true },
                          { name: 'Legacy_Wiki_Dump', type: 'S3 Bucket', status: 'Error', chunks: '45,000', model: 'ada-002', color: 'red' },
                        ].map((row) => (
                           <tr key={row.name} className="hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4">
                                 <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-slate-400">
                                       <span className="material-symbols-outlined text-sm">database</span>
                                    </div>
                                    <div>
                                       <p className="text-slate-100 font-bold">{row.name}</p>
                                       <p className="text-[10px] text-slate-500 font-medium">{row.type}</p>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-6 py-4">
                                 <span className={`px-2 py-0.5 rounded-full font-black uppercase tracking-widest text-[9px] bg-${row.color}-500/10 text-${row.color}-400 border border-${row.color}-500/20`}>{row.status}</span>
                              </td>
                              <td className="px-6 py-4 font-mono text-slate-400">{row.chunks}</td>
                              <td className="px-6 py-4">
                                 <span className="px-2 py-0.5 rounded border border-[#3b4354] bg-[#282e39] text-[10px] text-slate-400 font-bold">{row.model}</span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                 <button type="button" aria-label="More actions" className="text-slate-500 hover:text-white transition-colors"><span className="material-symbols-outlined">more_vert</span></button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
               <div className="p-8 border border-dashed border-[#3b4354] rounded-xl flex items-center justify-between bg-[#1c1f27]/50">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-full bg-[#135bec]/10 flex items-center justify-center text-[#135bec]">
                        <span className="material-symbols-outlined">add</span>
                     </div>
                     <div>
                        <h4 className="text-white font-bold text-sm uppercase tracking-widest">Connect New Source</h4>
                        <p className="text-[#9da6b9] text-xs">Supports Stax, S3, Google Drive, or CSV uploads.</p>
                     </div>
                  </div>
                  <button type="button" className="px-6 py-2.5 bg-[#282e39] hover:bg-[#323945] text-white text-[10px] font-black uppercase tracking-widest border border-[#3b4354] rounded-lg transition-all">Configure Connector</button>
               </div>
            </div>

            <div className="flex flex-col gap-6">
               <div className="bg-[#1c1f27] border border-[#3b4354] rounded-xl flex flex-col h-full shadow-sm">
                  <div className="p-5 border-b border-[#3b4354] bg-[#161920] flex items-center justify-between px-6">
                     <h3 className="text-white font-black text-xs uppercase tracking-widest flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#135bec] text-lg">science</span>
                        Retrieval Simulator
                     </h3>
                     <span className="text-[10px] text-[#9da6b9] bg-[#282e39] px-2 py-0.5 rounded font-black uppercase">Preview</span>
                  </div>
                  <div className="p-6 flex flex-col gap-6">
                     <div className="flex flex-col gap-2">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Test Query</span>
                        <div className="relative group">
                           <textarea className="w-full bg-[#0d1117] border border-[#3b4354] rounded-lg p-4 text-xs text-white focus:ring-1 focus:ring-[#135bec] outline-none h-24 resize-none transition-all" placeholder="Enter a user question..."></textarea>
                           <button type="button" aria-label="Run test query" className="absolute bottom-3 right-3 p-1.5 bg-[#135bec] text-white rounded-lg hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20">
                              <span className="material-symbols-outlined text-sm">play_arrow</span>
                           </button>
                        </div>
                     </div>
                     <div className="space-y-4 pt-2">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Top Results (k=3)</span>
                        {[
                          { score: '0.92', src: 'Stax_KB_v2', txt: 'To reset your API key, navigate to the User Settings panel...' },
                          { score: '0.78', src: 'Support_Q3', txt: 'User reported issues with API key rotation. Engineering confirmed...' },
                        ].map((res) => (
                           <div key={res.src} className="bg-[#0d1117] border border-[#3b4354] rounded-xl p-4 relative group hover:border-[#135bec]/50 transition-all">
                              <div className="absolute top-3 right-3 bg-[#135bec]/10 text-[#135bec] text-[10px] font-black px-2 py-0.5 rounded font-mono border border-[#135bec]/20">{res.score}</div>
                              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Src: {res.src}</p>
                              <p className="text-xs text-slate-300 leading-relaxed font-medium">{res.txt}</p>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
