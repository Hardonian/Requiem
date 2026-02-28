'use client';

import React from 'react';

export function TraceExplorer() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0a0c10] font-sans">
      <header className="h-16 border-b border-[#1e232b] bg-[#0d1117]/95 backdrop-blur flex items-center justify-between px-8 shrink-0 z-20">
        <div className="flex items-center gap-2">
          <span className="text-[#9da6b9] text-sm uppercase font-bold tracking-widest">Console</span>
          <span className="text-[#9da6b9] text-sm">/</span>
          <span className="text-white text-sm font-black uppercase tracking-widest">Trace Explorer</span>
        </div>
        <div className="flex items-center gap-4">
           <div className="relative group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#3b82f6] text-[18px]">search</span>
              <input className="bg-[#161b22] border border-[#30363d] rounded-lg pl-10 pr-4 py-2 text-xs text-white w-64 outline-none focus:ring-1 focus:ring-[#3b82f6]" placeholder="Trace ID or Agent..."/>
           </div>
           <button type="button" className="flex items-center gap-2 px-4 py-2 bg-[#161b22] border border-[#30363d] rounded-lg text-[10px] font-black uppercase tracking-widest text-[#9da6b9] hover:text-white transition-all">
              <span className="material-symbols-outlined text-[18px]">filter_list</span>
              Filters
           </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-y-auto scrollbar-hide p-8 md:p-12 pb-20">
           <div className="max-w-[1200px] w-full mx-auto flex flex-col gap-10">
              <div>
                 <h1 className="text-white text-4xl font-black uppercase tracking-tighter">Execution Timeline</h1>
                 <p className="text-[#9da6b9] text-base mt-2 max-w-2xl font-medium">Deep inspection of agency-driven execution steps, deterministic fallbacks, and model-aware routing decisions.</p>
              </div>

              <div className="flex flex-col gap-4 relative">
                 {/* Timeline Vertical Line */}
                 <div className="absolute left-[23px] top-6 bottom-6 w-[2px] bg-gradient-to-b from-[#3b82f6] via-[#3b82f6]/20 to-transparent"></div>

                 {[
                   { id: 'step-01', type: 'ROUTING', title: 'Intent Classification', status: 'SUCCESS', time: '12ms', details: 'Routed to Settlement Specialist', icon: 'route' },
                   { id: 'step-02', type: 'EXECUTION', title: 'Data Extraction', status: 'SUCCESS', time: '450ms', details: 'Parsed invoice metadata from S3', icon: 'database' },
                   { id: 'step-03', type: 'FALLBACK', title: 'Validation Retry', status: 'WARNING', time: '1.2s', details: 'Primary model hallucination detected. Deterministic fallback enabled.', icon: 'schema' },
                   { id: 'step-04', type: 'OUTPUT', title: 'Payload Finalization', status: 'SUCCESS', time: '24ms', details: 'JSON signed and dispatched to Zeo', icon: 'output' },
                 ].map((step, i) => (
                   <div key={step.id} className="flex gap-6 relative group cursor-pointer hover:translate-x-1 transition-transform">
                      <div className="z-10 w-12 h-12 rounded-full border-2 border-[#1e232b] bg-[#0d1117] flex items-center justify-center text-[#3b82f6] shadow-xl group-hover:border-[#3b82f6]/50">
                         <span className="material-symbols-outlined text-xl">{step.icon}</span>
                      </div>
                      <div className="flex-1 bg-[#161b22] border border-[#30363d] rounded-2xl p-6 transition-all group-hover:border-[#3b82f6]/30">
                         <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-col">
                               <span className="text-[10px] font-black uppercase tracking-widest text-[#3b82f6] mb-1">{step.type}</span>
                               <h3 className="text-white font-black text-sm uppercase tracking-widest">{step.title}</h3>
                            </div>
                            <div className="flex flex-col items-end">
                               <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${step.status === 'WARNING' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'}`}>{step.status}</span>
                               <span className="text-[10px] font-mono text-slate-500 mt-2">{step.time}</span>
                            </div>
                         </div>
                         <p className="text-xs text-slate-400 font-medium leading-relaxed">{step.details}</p>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        <div className="w-[450px] border-l border-[#1e232b] bg-[#0d1117] hidden xl:flex flex-col overflow-y-auto scrollbar-hide">
           <div className="p-8 border-b border-[#1e232b]">
              <h3 className="text-white font-black text-xs uppercase tracking-widest mb-4">Step Details</h3>
              <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] flex flex-col gap-4">
                 <div className="flex justify-between uppercase tracking-widest font-black text-[9px] text-slate-500">
                    <span>Trace ID</span>
                    <span className="text-white">tr_0x882a91...</span>
                 </div>
                 <div className="flex justify-between uppercase tracking-widest font-black text-[9px] text-slate-500">
                    <span>Model In</span>
                    <span className="text-[#3b82f6]">GPT-4-Turbo</span>
                 </div>
                 <div className="flex justify-between uppercase tracking-widest font-black text-[9px] text-slate-500">
                    <span>Latency</span>
                    <span className="text-white">504ms total</span>
                 </div>
              </div>
           </div>
           <div className="p-8 flex flex-col gap-6">
              <h4 className="font-black text-[10px] uppercase tracking-widest text-[#3b82f6]">Input Payload</h4>
              <div className="bg-[#0a0c10] border border-[#30363d] rounded-xl p-4 font-mono text-[10px] text-slate-400 leading-normal">
                 <pre>{JSON.stringify({
                    "action": "reconcile",
                    "target": "invoice_882",
                    "validation_gate": "deterministic-v1"
                 }, null, 2)}</pre>
              </div>
              <h4 className="font-black text-[10px] uppercase tracking-widest text-emerald-500">Model Response</h4>
              <div className="bg-[#0a0c10] border border-[#30363d] rounded-xl p-4 font-mono text-[10px] text-slate-400 leading-normal">
                 <pre>{JSON.stringify({
                    "status": "validated",
                    "match_score": 0.992,
                    "confidence": "high"
                 }, null, 2)}</pre>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
