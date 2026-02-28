'use client';

import React from 'react';

export function CostOptimization() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#101622] font-sans">
      <header className="flex-none h-16 border-b border-[#2e3646] flex items-center justify-between px-8 bg-[#111318]/50 backdrop-blur-sm z-10">
        <div className="flex flex-col">
          <h2 className="text-white text-lg font-bold uppercase tracking-widest text-[#135bec]">Cost & Model Optimization</h2>
          <p className="text-[#9da6b9] text-[10px] font-bold uppercase tracking-wide">Financial governance and model switching</p>
        </div>
        <div className="flex items-center gap-4">
          <button type="button" className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20">
            <span className="material-symbols-outlined text-[18px]">save</span>
            Save Configuration
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-8 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Current Month Spend', val: '$2,340.50', trend: '+12%', icon: 'attach_money', color: 'blue' },
              { label: 'Projected Spend', val: '$4,100.00', trend: '+5%', icon: 'trending_up', color: 'emerald' },
              { label: 'Active Agents', val: '12', trend: '-2%', icon: 'smart_toy', color: 'indigo' },
              { label: 'Avg Cost/Request', val: '$0.04', trend: '0%', icon: 'functions', color: 'teal' },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-[#1c1f2b] border border-[#2e3646] rounded-xl p-6 relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <span className="material-symbols-outlined text-4xl text-white">{kpi.icon}</span>
                </div>
                <p className="text-[#9da6b9] text-[10px] font-bold uppercase tracking-widest mb-1">{kpi.label}</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-black text-white tracking-tight">{kpi.val}</h3>
                  <span className={`text-${kpi.color}-400 text-[10px] font-bold`}>{kpi.trend}</span>
                </div>
                <div className={`absolute bottom-0 left-0 h-1 bg-${kpi.color}-500 w-full opacity-30`}></div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 flex flex-col gap-8">
               {/* Burn Projection Chart */}
               <div className="p-8 rounded-xl bg-[#1c1f2b] border border-[#2e3646] shadow-sm">
                  <div className="flex flex-wrap items-center justify-between mb-8 gap-4">
                    <div>
                      <h3 className="text-white font-black text-sm uppercase tracking-widest">Burn Projection</h3>
                      <p className="text-[#9da6b9] text-xs font-medium uppercase tracking-wide mt-1">Forecasted spend based on active model config.</p>
                    </div>
                    <div className="flex bg-[#111318] p-1 rounded-lg border border-white/5 text-[10px] font-bold uppercase tracking-widest">
                      <button type="button" className="px-4 py-2 rounded-md bg-[#135bec] text-white">Daily</button>
                      <button type="button" className="px-4 py-2 rounded-md text-[#9da6b9] hover:text-white transition-colors">Monthly</button>
                    </div>
                  </div>
                  <div className="h-64 flex items-end gap-3 px-4 border-b border-[#2e3646] pb-4">
                     {Array.from({ length: 12 }).map((_, i) => (
                       <div key={i} className="flex-1 bg-[#135bec]/20 hover:bg-[#135bec]/40 transition-all rounded-t relative group" style={{ height: `${Math.random() * 80 + 10}%` }}>
                          <div className={`absolute bottom-0 left-0 w-full bg-[#135bec] rounded-t ${i > 8 ? 'opacity-30' : ''}`} style={{ height: '60%' }}></div>
                       </div>
                     ))}
                  </div>
                  <div className="flex items-center justify-center gap-8 mt-6 text-[10px] font-bold uppercase tracking-widest text-[#9da6b9]">
                     <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-[#135bec]"></span>
                        <span>Actual Spend</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-[#135bec]/30"></span>
                        <span>Forecast</span>
                     </div>
                  </div>
               </div>

               {/* Model Switch Simulator */}
               <div className="p-8 rounded-xl bg-[#1c1f2b] border border-[#2e3646] shadow-sm">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                      <span className="material-symbols-outlined">swap_horiz</span>
                    </div>
                    <div>
                      <h3 className="text-white font-black text-sm uppercase tracking-widest">Model Switch Simulator</h3>
                      <p className="text-[#9da6b9] text-xs font-medium uppercase tracking-wide mt-1">Estimate savings by switching default models.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                     <div className="space-y-6">
                        <div>
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Current Model</label>
                           <div className="p-4 bg-[#111318] border border-white/5 rounded-xl flex items-center justify-between">
                              <span className="text-white font-bold text-sm">GPT-4-Turbo</span>
                              <span className="text-[#9da6b9] font-mono text-xs">$10.00/1M</span>
                           </div>
                        </div>
                        <div className="flex items-center justify-center text-slate-700">
                           <span className="material-symbols-outlined">expand_more</span>
                        </div>
                        <div>
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Target Model</label>
                           <select className="w-full bg-[#111318] border border-white/10 text-white rounded-xl p-4 text-xs font-bold focus:ring-1 focus:ring-[#135bec] outline-none appearance-none">
                              <option>Llama-3-70b-Instruct</option>
                              <option>Claude-3-Sonnet</option>
                           </select>
                        </div>
                     </div>
                     <div className="p-8 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex flex-col items-center text-center">
                        <span className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-2">Projected Monthly Savings</span>
                        <span className="text-4xl font-black text-white mb-2">$1,245.00</span>
                        <p className="text-emerald-400/80 text-[10px] font-bold uppercase tracking-wide">~32% Reduction in OPEX</p>
                        <button type="button" className="mt-6 w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-500/20">Apply Optimized Config</button>
                     </div>
                  </div>
               </div>
            </div>

            <div className="flex flex-col gap-8">
               <div className="p-8 rounded-xl bg-[#1c1f2b] border border-[#2e3646] shadow-sm">
                  <h3 className="text-white font-black text-sm uppercase tracking-widest mb-6">Global Default</h3>
                  <div className="space-y-6">
                     <div className="relative">
                        <select className="w-full bg-[#111318] border border-[#2e3646] text-white text-xs font-bold rounded-xl p-4 pr-10 outline-none appearance-none">
                           <option>GPT-4-Turbo</option>
                           <option>Claude-3-Opus</option>
                        </select>
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#9da6b9] pointer-events-none">expand_more</span>
                     </div>
                     <div className="pt-6 border-t border-white/5 space-y-4">
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Fallback Chain</p>
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                           <span className="bg-[#111318] px-3 py-1.5 rounded border border-white/5">GPT-4</span>
                           <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                           <span className="bg-[#111318] px-3 py-1.5 rounded border border-white/5">Llama</span>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="p-8 rounded-xl bg-[#1c1f2b] border border-[#2e3646] shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <span className="material-symbols-outlined text-rose-500">gpp_maybe</span>
                    <h3 className="text-white font-black text-sm uppercase tracking-widest">Circuit Breakers</h3>
                  </div>
                  <div className="space-y-6">
                     <div className="flex items-center justify-between">
                        <div>
                           <p className="text-white text-xs font-bold uppercase tracking-widest">Daily Hard Limit</p>
                           <p className="text-slate-500 text-[9px] font-medium uppercase mt-1">Stops non-critical agents</p>
                        </div>
                        <div className="w-10 h-5 bg-[#135bec] rounded-full relative"><div className="w-4 h-4 bg-white rounded-full absolute top-0.5 right-0.5"></div></div>
                     </div>
                     <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                        <input className="w-full bg-[#111318] border border-[#2e3646] rounded-xl py-3 pl-8 pr-12 text-white font-mono text-sm outline-none" value="500"/>
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 font-black text-[10px]">USD</span>
                     </div>
                  </div>
               </div>

               {/* Top Spenders Mini */}
               <div className="p-8 rounded-xl bg-[#1c1f2b] border border-[#2e3646] shadow-sm">
                  <h3 className="text-white font-black text-sm uppercase tracking-widest mb-6">Top Spenders</h3>
                  <div className="space-y-4">
                     {[
                       { name: 'DataScraper-01', val: '$45.20', clr: 'rose' },
                       { name: 'SupportBot-Main', val: '$28.90', clr: 'orange' },
                       { name: 'Summarizer-X', val: '$12.50', clr: 'yellow' },
                     ].map((item) => (
                       <div key={item.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className={`w-8 h-8 rounded bg-${item.clr}-500/10 text-${item.clr}-500 flex items-center justify-center font-black text-[10px]`}>{item.name[0]}</div>
                             <span className="text-white text-xs font-bold">{item.name}</span>
                          </div>
                          <span className={`text-${item.clr}-400 font-mono font-bold text-xs`}>{item.val}</span>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
