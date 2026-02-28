'use client';

import React, { useState } from 'react';

export function EvaluationEngine() {
  const [weights, setWeights] = useState({
    grounding: 75,
    accuracy: 90,
    structure: 40,
    latency: 30,
    cost: 60,
  });

  const history = [
    { version: 'v2.4.0', time: 'Just now', title: 'Drift correction on Q3', user: 'Sarah J.', active: true },
    { version: 'v2.3.9', time: '2h ago', title: 'Increased Latency tolerance', user: 'Mike R.' },
    { version: 'v2.3.8', time: 'Yesterday', title: 'Baseline grounding adjustment', user: 'Sarah J.' },
    { version: 'v2.3.7', time: '2 days ago', title: 'Rollback: Cost optimization', user: 'System' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#101622]">
      <div className="flex flex-1 overflow-hidden">
        {/* Inner Sidebar: Config History */}
        <aside className="w-72 bg-[#0d1117] border-r border-slate-800 flex flex-col overflow-y-auto shrink-0 scrollbar-hide">
          <div className="p-4 border-b border-slate-800 sticky top-0 bg-[#0d1117] z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-xs font-bold uppercase tracking-wider">Config History</h2>
              <button type="button" className="text-[#135bec] hover:text-blue-400 text-xs font-semibold">View All</button>
            </div>
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-2 top-2 text-slate-500 text-sm group-focus-within:text-[#135bec]">search</span>
              <input className="w-full bg-[#1c2333] border border-slate-700 rounded text-xs text-white pl-8 pr-2 py-2 focus:outline-none focus:ring-1 focus:ring-[#135bec]" placeholder="Filter versions..."/>
            </div>
          </div>
          <div className="flex flex-col">
            {history.map((item) => (
              <div key={item.version} className={`p-4 border-l-2 cursor-pointer transition-colors ${item.active ? 'border-[#135bec] bg-[#135bec]/5' : 'border-l-transparent border-b border-slate-800/50 hover:bg-[#1c2333]'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`${item.active ? 'text-[#135bec]' : 'text-slate-400'} text-xs font-bold`}>{item.version} {item.active && '(Current)'}</span>
                  <span className="text-slate-500 text-[10px]">{item.time}</span>
                </div>
                <p className={`${item.active ? 'text-white' : 'text-slate-300'} text-sm font-medium mb-1`}>{item.title}</p>
                <div className="flex items-center gap-2">
                   <div className="w-4 h-4 rounded-full bg-slate-700"></div>
                   <span className="text-slate-500 text-xs">{item.user}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide font-sans">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-white text-3xl font-bold tracking-tight mb-2 uppercase">Metric Governance</h1>
              <p className="text-[#9da6b9] text-base">Manage scoring governance and drift control for your agentic workflows.</p>
            </div>
            <div className="flex gap-3">
              <button type="button" className="flex items-center justify-center rounded-lg h-10 px-4 bg-slate-800 border border-slate-700 text-white text-xs font-bold hover:bg-slate-700 transition-all">
                <span className="material-symbols-outlined text-sm mr-2">history</span>
                Compare Versions
              </button>
              <button type="button" className="flex items-center justify-center rounded-lg h-10 px-4 bg-white text-slate-900 text-xs font-black hover:bg-slate-200 transition-all shadow-xl shadow-white/5 uppercase tracking-widest">
                <span className="material-symbols-outlined text-sm mr-2">play_arrow</span>
                Run Synthetic Eval
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6 pb-8">
            <div className="col-span-12 xl:col-span-8 flex flex-col gap-6">
              {/* Weight Editor */}
              <div className="bg-[#1c2333] rounded-xl border border-slate-700 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-700 bg-[#161b28] flex justify-between items-center px-6">
                  <div className="flex items-center gap-2 font-bold uppercase tracking-widest text-[#135bec]">
                    <span className="material-symbols-outlined">tune</span>
                    <h3 className="text-xs">Metric Weight Editor</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#9da6b9] text-[10px] font-bold uppercase tracking-widest">Lock Weights</span>
                    <button type="button" aria-label="Lock Weights" className="relative inline-flex h-5 w-9 items-center rounded-full bg-slate-700"><span className="inline-block h-3 w-3 transform rounded-full bg-white translate-x-1 transition"></span></button>
                  </div>
                </div>
                <div className="p-8 grid gap-8">
                  {[
                    { key: 'grounding', label: 'Grounding', sub: 'RAG Fidelity' },
                    { key: 'accuracy', label: 'Accuracy', sub: 'Factuality' },
                    { key: 'structure', label: 'Structure', sub: 'JSON Validity' },
                    { key: 'latency', label: 'Latency', sub: '<200ms target' },
                    { key: 'cost', label: 'Cost', sub: '$/1k tokens' },
                  ].map((field) => (
                    <div key={field.key} className="flex items-center gap-6">
                       <div className="w-32 shrink-0">
                          <p className="text-white text-sm font-bold">{field.label}</p>
                          <p className="text-slate-500 text-[10px] uppercase font-medium tracking-wide">{field.sub}</p>
                       </div>
                       <input 
                         type="range" 
                         aria-label={field.label}
                         value={weights[field.key as keyof typeof weights]} 
                         onChange={(e) => setWeights({ ...weights, [field.key]: parseInt(e.target.value) })}
                         className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#135bec]"
                       />
                       <div className="w-16 shrink-0 bg-[#0f1218] border border-slate-700 rounded px-2 py-1.5 text-right text-white text-xs font-mono font-bold">
                         {(weights[field.key as keyof typeof weights] / 100).toFixed(2)}
                       </div>
                    </div>
                  ))}
                </div>
                <div className="px-8 py-4 bg-[#161b28] border-t border-slate-700 flex justify-end gap-3 text-xs font-bold uppercase tracking-widest">
                  <button type="button" className="text-slate-400 hover:text-white px-3 py-2">Reset</button>
                  <button type="button" className="bg-[#135bec] hover:bg-blue-600 text-white rounded px-6 py-2.5 shadow-lg shadow-blue-500/20">Apply Changes</button>
                </div>
              </div>

              {/* Historical Graph Area */}
              <div className="bg-[#1c2333] rounded-xl border border-slate-700 p-8">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-white font-bold text-sm uppercase tracking-widest">Historical Scores</h3>
                    <p className="text-slate-500 text-xs mt-1">Weighted performance over the last 30 days</p>
                  </div>
                  <div className="flex gap-4">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400"><span className="w-2 h-2 rounded-full bg-[#135bec]"></span> Production</span>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Synthetic</span>
                  </div>
                </div>
                <div className="w-full h-48 bg-linear-to-b from-[#135bec]/5 to-transparent rounded border border-slate-700 relative overflow-hidden flex items-end px-2">
                   {/* Simplified Graph Visual */}
                   <div className="absolute inset-0 flex items-end">
                      <svg className="w-full h-full" viewBox="0 0 1000 200" preserveAspectRatio="none">
                        <path d="M0,150 Q250,140 500,80 T1000,50" fill="none" stroke="#135bec" strokeWidth="3" />
                        <path d="M0,180 Q250,160 500,120 T1000,90" fill="none" stroke="#a855f7" strokeWidth="2" strokeDasharray="6" opacity="0.5" />
                      </svg>
                   </div>
                   <div className="flex justify-between w-full mt-2 text-[10px] font-mono font-bold text-slate-600 pb-2">
                      <span>Aug 01</span>
                      <span>Aug 15</span>
                      <span>Today</span>
                   </div>
                </div>
              </div>
            </div>

            <div className="col-span-12 xl:col-span-4 flex flex-col gap-6">
               {/* Simulator */}
               <div className="bg-[#1c2333] rounded-xl border border-slate-700 flex flex-col">
                  <div className="p-4 border-b border-slate-700 flex justify-between items-center px-6 bg-[#161b28]">
                    <h3 className="text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                       <span className="material-symbols-outlined text-purple-400 text-lg">science</span>
                       Simulator
                    </h3>
                    <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-black px-2 py-0.5 rounded tracking-widest uppercase">Passed</span>
                  </div>
                  <div className="p-6 flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                       <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Input Prompt</span>
                       <div className="bg-[#0f1218] rounded border border-slate-700 p-4 text-xs text-slate-300 font-mono leading-relaxed">
                         Summarize the Q3 earnings for the retail sector...
                       </div>
                    </div>
                    <div className="flex flex-col gap-2 relative">
                       <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Agent Output</span>
                       <div className="bg-[#0f1218] rounded border border-slate-700 p-4 text-xs text-slate-300 font-mono leading-relaxed min-h-[120px]">
                         The retail sector saw a 4.5% increase in revenue year-over-year...
                       </div>
                       <div className="absolute bottom-4 right-4 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-xl p-3 flex flex-col items-center shadow-2xl">
                          <span className="text-[8px] text-slate-500 uppercase font-bold">Total Score</span>
                          <span className="text-2xl font-black text-white">92</span>
                          <span className="text-[9px] text-emerald-400 font-bold uppercase">Optimal</span>
                       </div>
                    </div>
                  </div>
               </div>

               {/* Comparison Table */}
               <div className="bg-[#1c2333] rounded-xl border border-slate-700 flex flex-col flex-1 overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-700 px-6 bg-[#161b28]">
                    <h3 className="text-white font-bold text-xs uppercase tracking-widest">Model Comparison</h3>
                    <p className="text-slate-500 text-[10px] mt-1 font-medium uppercase tracking-wide">Drift detection against policy</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#0d1117] text-[10px] uppercase font-bold tracking-widest text-slate-500">
                        <tr>
                          <th className="px-6 py-4">Model</th>
                          <th className="px-6 py-4 text-right">Score</th>
                          <th className="px-6 py-4 text-right">Drift</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-xs">
                        {[
                          { m: 'GPT-4 Judge', s: '94.2', d: '+0.2%', c: 'text-emerald-400' },
                          { m: 'Claude 3', s: '88.1', d: '-5.4%', c: 'text-red-400', w: true },
                          { m: 'Llama 3 70B', s: '91.0', d: '+1.1%', c: 'text-emerald-400' },
                        ].map((row) => (
                          <tr key={row.m} className={`hover:bg-white/5 transition-colors ${row.w ? 'bg-red-500/5' : ''}`}>
                            <td className="px-6 py-4 font-bold text-slate-100 flex items-center gap-2">
                              {row.m}
                              {row.w && <span className="material-symbols-outlined text-red-500 text-[14px]">warning</span>}
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-bold text-slate-300">{row.s}</td>
                            <td className={`px-6 py-4 text-right font-mono font-bold ${row.c}`}>{row.d}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
