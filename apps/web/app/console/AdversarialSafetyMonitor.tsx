'use client';

import React from 'react';

export function AdversarialSafetyMonitor() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#101922] font-sans scrollbar-hide">
      <div className="sticky top-0 z-20 bg-[#101922]/95 backdrop-blur-md border-b border-[#283039] px-8 py-4 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm text-[#9dabb9]">
            <span>Console</span>
            <span className="material-symbols-outlined text-[12px]">chevron_right</span>
            <span>Governance</span>
            <span className="material-symbols-outlined text-[12px]">chevron_right</span>
            <span className="text-white font-medium">Safety Monitor</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
            Adversarial Safety & Trust Monitor
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1c2632] border border-[#283442] text-[#9dabb9] hover:text-white transition-all text-sm font-medium">
            <span className="material-symbols-outlined text-[18px]">calendar_today</span>
            Last 24 Hours
          </button>
          <button type="button" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#137fec] text-white text-sm font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export Report
          </button>
        </div>
      </div>

      <div className="p-8 flex flex-col gap-8 max-w-[1600px] mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           {[
             { label: 'System Trust Score', val: '94/100', trend: '+2%', icon: 'verified_user', color: 'emerald' },
             { label: 'Active Threats Blocked', val: '12', trend: '+4', icon: 'shield', color: 'blue' },
             { label: 'PII Traces Scanned', val: '1.4M', trend: '99.9% clean', icon: 'fingerprint', color: 'indigo' },
             { label: 'Audit Readiness', val: '92%', trend: 'Ready', icon: 'fact_check', color: 'teal' },
           ].map((kpi) => (
             <div key={kpi.label} className="bg-[#1c2632] border border-[#283442] rounded-xl p-6 relative overflow-hidden group hover:border-[#137fec]/30 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-[#9dabb9] text-sm font-bold uppercase tracking-widest">{kpi.label}</p>
                    <h3 className="text-3xl font-black text-white tracking-tight">{kpi.val}</h3>
                  </div>
                  <div className={`p-2 bg-${kpi.color}-500/10 rounded-lg text-${kpi.color}-400`}>
                    <span className="material-symbols-outlined">{kpi.icon}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#9dabb9]">
                   <span className="text-emerald-400">{kpi.trend}</span>
                   <span>vs last period</span>
                </div>
                <div className={`absolute bottom-0 left-0 h-1 bg-${kpi.color}-500 w-full opacity-50`}></div>
             </div>
           ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-[#1c2632] border border-[#283442] rounded-xl p-8 flex flex-col gap-6">
            <div className="flex justify-between items-center">
               <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-widest">PII/PHI Leakage Monitor</h3>
                  <p className="text-sm text-[#9dabb9]">Real-time scan of sensitive data traces across all agents</p>
               </div>
               <div className="flex gap-4">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400"><span className="w-2 h-2 rounded-full bg-[#137fec]"></span> Safe Traffic</span>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400"><span className="w-2 h-2 rounded-full bg-red-500"></span> Blocked PII</span>
               </div>
            </div>
            <div className="h-64 bg-[#111821] rounded-lg border border-[#283442] relative overflow-hidden flex items-end gap-1 px-4">
               {/* Simplified Bars */}
               {Array.from({ length: 24 }).map((_, i) => (
                 <div key={i} className={`flex-1 transition-all rounded-t ${i === 12 || i === 18 ? 'bg-red-500/80 hover:bg-red-500' : 'bg-[#137fec]/20 hover:bg-[#137fec]/40'}`} style={{ height: `${Math.random() * 80 + 10}%` }}></div>
               ))}
            </div>
          </div>

          <div className="lg:col-span-1 bg-[#1c2632] border border-[#283442] rounded-xl p-8 flex flex-col gap-6">
            <h3 className="text-lg font-black text-white uppercase tracking-widest">Data Sovereignty</h3>
            <div className="flex-1 bg-[#111821] rounded-xl border border-[#283442] relative overflow-hidden flex items-center justify-center p-4">
               {/* Map Placeholder */}
               <div className="text-[#283442]">
                  <span className="material-symbols-outlined text-[120px]">public</span>
               </div>
               <div className="absolute top-[30%] left-[50%] flex flex-col items-center">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-pulse"></div>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[8px] font-black uppercase mt-1">EU-West-1 Locked</span>
               </div>
            </div>
            <div className="space-y-3 font-bold uppercase tracking-widest text-[10px]">
               <div className="flex justify-between border-b border-[#283442] pb-2">
                  <span className="text-[#9dabb9]">Active Region</span>
                  <span className="text-white">Frankfurt (EU)</span>
               </div>
               <div className="flex justify-between">
                  <span className="text-[#9dabb9]">Leakage Status</span>
                  <span className="text-emerald-400">Validated Clean</span>
               </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
           <div className="lg:col-span-2 bg-[#1c2632] border border-[#283442] rounded-xl flex flex-col overflow-hidden">
              <div className="p-6 border-b border-[#283442] bg-[#283442]/20">
                 <h3 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-500">bug_report</span>
                    Prompt Injection Attempts
                 </h3>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-left font-sans">
                    <thead className="bg-[#111821] text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <tr>
                        <th className="px-6 py-4">Timestamp</th>
                        <th className="px-6 py-4">Agent ID</th>
                        <th className="px-6 py-4">Confidence</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#283442] text-xs">
                       {[
                         { t: '10:42:05 AM', a: 'Customer_Svc_Bot_01', c: '98%', s: 'Blocked', clr: 'red' },
                         { t: '10:38:12 AM', a: 'Finance_Analyst_04', c: '85%', s: 'Flagged', clr: 'amber' },
                         { t: '10:15:30 AM', a: 'Sales_Coach_Agent', c: '92%', s: 'Blocked', clr: 'red' },
                       ].map((attempt, i) => (
                         <tr key={i} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4 font-mono text-[#9dabb9]">{attempt.t}</td>
                            <td className="px-6 py-4 font-bold text-white">{attempt.a}</td>
                            <td className="px-6 py-4 font-black text-red-400">{attempt.c}</td>
                            <td className="px-6 py-4 text-right">
                               <span className={`px-2 py-0.5 rounded-full font-black uppercase tracking-widest text-[9px] bg-${attempt.clr}-500/10 text-${attempt.clr}-400 border border-${attempt.clr}-500/20`}>{attempt.s}</span>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>

           <div className="lg:col-span-1 bg-[#1c2632] border border-[#283442] rounded-xl p-8 flex flex-col gap-6">
              <h3 className="text-lg font-black text-white uppercase tracking-widest">Jailbreak Resilience</h3>
              <div className="space-y-4">
                 {[
                   { name: 'Legal_Doc_Review', score: '98%', grade: 'A', color: 'emerald' },
                   { name: 'Creative_Writer_V2', score: '72%', grade: 'B-', color: 'amber' },
                   { name: 'Support_Triage_Bot', score: '94%', grade: 'A', color: 'emerald' },
                 ].map((agent) => (
                   <div key={agent.name} className="flex items-center gap-4 p-4 rounded-xl border border-[#283442] bg-[#111821] hover:border-[#137fec]/50 transition-all cursor-pointer">
                      <div className={`w-10 h-10 rounded-full border-2 border-${agent.color}-500/30 flex items-center justify-center font-black text-${agent.color}-400`}>
                        {agent.grade}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-white">{agent.name}</h4>
                        <div className="w-full bg-[#283442] h-1 rounded-full mt-1">
                           <div className={`bg-${agent.color}-500 h-1 rounded-full`} style={{ width: agent.score }}></div>
                        </div>
                      </div>
                      <span className={`text-sm font-black text-${agent.color}-400`}>{agent.score}</span>
                   </div>
                 ))}
              </div>
              <button type="button" className="mt-2 w-full py-2.5 text-[10px] font-black uppercase tracking-widest text-[#9dabb9] hover:text-white border border-[#283442] rounded-xl hover:bg-[#283442] transition-colors">Run Resilience Audit</button>
           </div>
        </div>
      </div>
    </div>
  );
}
