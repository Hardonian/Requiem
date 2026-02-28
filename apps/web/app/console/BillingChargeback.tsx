'use client';

import React, { useState } from 'react';
import { ReasonForChangeModal } from '@/components/stitch/shared/ReasonForChangeModal';

export function BillingChargeback() {
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  function handleInvoiceConfirm(reason: string) {
    // Backend not wired: log reason to console and close modal
    console.info('[Audit] Generate Invoices requested. Reason:', reason);
    setInvoiceModalOpen(false);
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#111418] font-sans scrollbar-hide">
      <div className="h-16 border-b border-[#3b4754] bg-[#111418]/95 backdrop-blur flex items-center justify-between px-8 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <span className="text-[#9dabb9] text-sm uppercase font-bold tracking-widest">Console</span>
          <span className="text-[#9dabb9] text-sm">/</span>
          <span className="text-white text-sm font-black uppercase tracking-widest">Billing & Chargeback</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 bg-[#1a212a] rounded-lg p-1 border border-[#3b4754]">
            <button type="button" className="px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest bg-[#3b4754] text-white">This Month</button>
            <button type="button" className="px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest text-[#9dabb9] hover:text-white transition-all">Last Month</button>
          </div>
        </div>
      </div>

      <div className="p-8 md:p-12 flex flex-col gap-10 max-w-[1400px] mx-auto w-full pb-20">
        <div className="flex flex-wrap justify-between items-end gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-white text-4xl font-black tracking-tighter uppercase">Internal Billing & Chargeback</h1>
            <p className="text-[#9dabb9] text-base font-medium max-w-2xl">Manage usage-based monetization, cost recovery, and department budgets across the ReadyLayer ecosystem.</p>
          </div>
          <div className="flex gap-4">
            <button type="button" className="flex items-center gap-2 px-6 py-3 rounded-xl border border-[#3b4754] bg-[#1a212a] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#283039] transition-all">
              <span className="material-symbols-outlined text-[18px]">download</span>
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => setInvoiceModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#137fec] text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-blue-500/20"
            >
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
              Generate Invoices
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
           {[
             { label: 'Total Cloud Cost', val: '$12,450', trend: '+2.5%', icon: 'cloud_queue', color: 'blue' },
             { label: 'Internal Chargeback', val: '$14,200', trend: '+3.1%', icon: 'monetization_on', color: 'indigo' },
             { label: 'Net Margin', val: '+14.05%', trend: '+0.5%', icon: 'query_stats', color: 'emerald' },
             { label: 'Teams Over Budget', val: '2 / 14', trend: 'CRITICAL', icon: 'warning', color: 'amber' },
           ].map((kpi) => (
             <div key={kpi.label} className="flex flex-col gap-4 rounded-2xl p-6 bg-[#1a212a] border border-[#3b4754] relative overflow-hidden group hover:border-[#137fec]/30 transition-all">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <span className="material-symbols-outlined text-4xl text-white">{kpi.icon}</span>
                </div>
                <p className="text-[#9dabb9] text-[10px] font-black uppercase tracking-widest">{kpi.label}</p>
                <h3 className="text-3xl font-black text-white tracking-tight">{kpi.val}</h3>
                <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-${kpi.color}-500/10 text-${kpi.color}-400 w-fit px-2 py-1 rounded border border-${kpi.color}-500/20`}>
                  {kpi.trend}
                </div>
             </div>
           ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-[#1a212a] border border-[#3b4754] rounded-2xl p-8 flex flex-col gap-6">
            <h3 className="text-white font-black text-sm uppercase tracking-widest">Cost Recovery Trend</h3>
            <div className="h-72 w-full bg-[#111418] rounded-xl border border-[#3b4754]/50 relative flex items-end justify-between px-8 pb-4">
               {/* Simplified recovery bars */}
               {Array.from({ length: 8 }).map((_, i) => (
                 <div key={i} className="w-[10%] h-full flex items-end justify-center relative group">
                    <div className="w-full bg-slate-700 rounded-t h-[60%] relative">
                       <div className="absolute bottom-0 w-full bg-[#137fec] rounded-t hover:bg-blue-400 transition-all cursor-help" style={{ height: `${Math.random() * 40 + 80}%` }}></div>
                    </div>
                 </div>
               ))}
            </div>
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-[#9dabb9] px-4">
               <span>Week 1</span>
               <span>Week 2</span>
               <span>Week 3</span>
               <span>Week 4</span>
            </div>
          </div>

          <div className="flex flex-col gap-8">
             <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8 flex flex-col gap-6">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-red-500/10 rounded-xl text-red-500">
                      <span className="material-symbols-outlined">money_off</span>
                   </div>
                   <h3 className="text-white font-black text-xs uppercase tracking-widest">Revenue Leakage</h3>
                </div>
                <div className="space-y-4">
                   {[
                     { name: 'Agent Loop #442', dept: 'Marketing', val: '-$104.20' },
                     { name: 'Embeddings Sync', dept: 'Data Science', val: '-$89.50' },
                   ].map((leak) => (
                     <div key={leak.name} className="flex justify-between items-center p-4 rounded-xl bg-red-500/5 border border-red-500/10 group hover:border-red-500/30 transition-all">
                        <div>
                           <p className="text-white text-xs font-bold">{leak.name}</p>
                           <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{leak.dept}</p>
                        </div>
                        <span className="text-red-400 font-black font-mono text-sm">{leak.val}</span>
                     </div>
                   ))}
                </div>
             </div>

             <div className="bg-[#1a212a] border border-[#3b4754] rounded-2xl p-8 flex flex-col gap-6">
                <h3 className="text-white font-black text-xs uppercase tracking-widest">Spend by Model</h3>
                <div className="space-y-6">
                   {[
                     { label: 'GPT-4 Turbo', val: '55%', color: 'bg-[#137fec]' },
                     { label: 'Claude 3 Opus', val: '30%', color: 'bg-purple-500' },
                     { label: 'Mistral Large', val: '15%', color: 'bg-orange-400' },
                   ].map((model) => (
                     <div key={model.label}>
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                           <span className="text-slate-400">{model.label}</span>
                           <span className="text-white">{model.val}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                           <div className={`h-full ${model.color}`} style={{ width: model.val }}></div>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
           <div className="flex justify-between items-end">
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Department Chargeback Detail</h2>
           </div>
           <div className="overflow-hidden border border-[#3b4754] rounded-3xl bg-[#1a212a] shadow-2xl">
              <table className="w-full text-left">
                 <thead>
                    <tr className="bg-[#242c36] border-b border-[#3b4754] text-[10px] font-black uppercase tracking-widest text-[#9dabb9]">
                       <th className="px-8 py-5">Dept / Project</th>
                       <th className="px-8 py-5 text-right">Tokens</th>
                       <th className="px-8 py-5 text-right">Raw Cost</th>
                       <th className="px-8 py-5 text-right">Markup</th>
                       <th className="px-8 py-5 text-right text-white">Chargeback</th>
                       <th className="px-8 py-5">Budget Status</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-[#3b4754] text-xs">
                    {[
                      { dept: 'Engineering', sub: 'Project Alpha', tok: '42.5M', raw: '$4,250', mark: '15%', total: '$4,887', pct: 48, clr: 'emerald' },
                      { dept: 'Data Science', sub: 'RAG Pipeline', tok: '28.1M', raw: '$2,810', mark: '10%', total: '$3,091', pct: 98, clr: 'red' },
                      { dept: 'Marketing', sub: 'Social Copy', tok: '5.2M', raw: '$520', mark: '20%', total: '$624', pct: 12, clr: 'indigo' },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
                         <td className="px-8 py-6">
                            <p className="text-white font-black text-sm">{row.dept}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{row.sub}</p>
                         </td>
                         <td className="px-8 py-6 text-right font-mono text-slate-400">{row.tok}</td>
                         <td className="px-8 py-6 text-right font-mono text-slate-400">{row.raw}</td>
                         <td className="px-8 py-6 text-right font-black text-emerald-400 font-mono">{row.mark}</td>
                         <td className="px-8 py-6 text-right font-black text-white font-mono text-sm">{row.total}</td>
                         <td className="px-8 py-6">
                            <div className="flex flex-col gap-2">
                               <div className="flex justify-between font-black text-[9px] uppercase tracking-widest">
                                  <span className={`text-${row.clr}-400`}>{row.pct}%</span>
                               </div>
                               <div className="h-1 w-40 bg-slate-800 rounded-full overflow-hidden">
                                  <div className={`h-full bg-${row.clr}-500 transition-all`} style={{ width: `${row.pct}%` }}></div>
                               </div>
                            </div>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      </div>

      <ReasonForChangeModal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        onConfirm={handleInvoiceConfirm}
        actionName="Generate Invoices"
      />
    </div>
  );
}
