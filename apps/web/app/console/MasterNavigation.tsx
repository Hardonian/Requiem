'use client';

import React from 'react';
import Link from 'next/link';
import { ROUTES } from '@/lib/routes';

export function MasterNavigation() {
  const pillars = [
    {
      id: '01',
      title: 'Core OS',
      icon: 'memory',
      nodes: [
        { name: 'Command Center', path: ROUTES.CONSOLE.HOME, route: '/console', role: 'Admin', desc: 'Centralized dashboard for orchestration control.', access: 'Admin' },
        { name: 'Runners', path: ROUTES.CONSOLE.RUNNERS, route: '/runners', role: 'Admin', desc: 'Manage active runtime containers and job queues.', access: 'Admin' },
        { name: 'Agents', path: ROUTES.CONSOLE.AGENTS.HOME, route: '/agents', role: 'User', desc: 'Configure AI agent behaviors and personality.', access: 'User' },
        { name: 'Traces', path: ROUTES.CONSOLE.TRACES, route: '/traces', role: 'User', desc: 'Inspect execution traces and step reasoning.', access: 'User' },
      ]
    },
    {
      id: '02',
      title: 'Governance',
      icon: 'security',
      nodes: [
        { name: 'Policy Enforcement', path: ROUTES.CONSOLE.GOVERNANCE.HOME, route: '/governance', role: 'Admin', desc: 'Define and enforce safety guardrails.', access: 'Admin' },
        { name: 'QA & Testing', path: ROUTES.CONSOLE.EVALUATION.HOME, route: '/evaluation', role: 'User', desc: 'Run regression tests and performance metrics.', access: 'User' },
        { name: 'Cost Management', path: ROUTES.CONSOLE.COST.HOME, route: '/cost', role: 'Admin', desc: 'Track compute usage and token consumption.', access: 'Admin' },
        { name: 'Billing Control', path: ROUTES.CONSOLE.BILLING, route: '/billing', role: 'Admin', desc: 'Monetization and department chargebacks.', access: 'Admin' },
        { name: 'Safety Monitor', path: ROUTES.CONSOLE.SAFETY, route: '/safety', role: 'User', desc: 'Adversarial safety and trust monitoring.', access: 'User' },
        { name: 'Semantic Ledger', path: ROUTES.CONSOLE.GOVERNANCE.SEMANTIC_LEDGER, route: '/governance/semantic-ledger', role: 'Admin', desc: 'Governed semantic states with integrity and drift filters.', access: 'Admin' },
        { name: 'Transition Viewer', path: ROUTES.CONSOLE.GOVERNANCE.TRANSITION_VIEWER, route: '/governance/transition-viewer', role: 'Admin', desc: 'Inspect state transitions, replay posture, and policy bindings.', access: 'Admin' },
      ]
    },
    {
      id: '03',
      title: 'Ecosystem',
      icon: 'dataset',
      nodes: [
        { name: 'Training Data', path: ROUTES.CONSOLE.DATASETS, route: '/datasets', role: 'User', desc: 'Manage RAG knowledge bases and fine-tuning.', access: 'User' },
        { name: 'Integrations', path: ROUTES.CONSOLE.INTEGRATIONS, route: '/integrations', role: 'Admin', desc: 'API connectors and secure webhooks.', access: 'Admin' },
        { name: 'Plugin Manager', path: ROUTES.CONSOLE.ECOSYSTEM.HOME, route: '/ecosystem', role: 'User', desc: 'Install and manage capability plugins.', access: 'User' },
        { name: 'Artifacts', path: ROUTES.CONSOLE.ARTIFACTS, route: '/artifacts', role: 'User', desc: 'Repository of agent-generated outputs.', access: 'User' },
      ]
    },
    {
      id: '04',
      title: 'Public',
      icon: 'public',
      nodes: [
        { name: 'Documentation', path: ROUTES.WEB.ARCHITECTURE, route: '/architecture', role: 'Public', desc: 'Full system documentation and diagrams.', access: 'Public' },
        { name: 'Transparency', path: ROUTES.WEB.TRANSPARENCY, route: '/transparency', role: 'Public', desc: 'Public-facing immutable audit logs.', access: 'Public' },
        { name: 'Marketplace', path: ROUTES.MARKETPLACE, route: '/marketplace', role: 'User', desc: 'Discover and deploy community agents.', access: 'User' },
        { name: 'Account Settings', path: ROUTES.CONSOLE.PROFILE, route: '/profile', role: 'User', desc: 'Manage preferences and security keys.', access: 'User' },
      ]
    }
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#101922] font-sans relative">
      {/* Blueprint Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#283039_1px,transparent_1px),linear-gradient(to_bottom,#283039_1px,transparent_1px)] bg-[length:40px_40px] opacity-10 [mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)] pointer-events-none"></div>

      <header className="h-16 border-b border-[#283039] bg-[#101922]/80 backdrop-blur flex items-center justify-between px-10 shrink-0 z-20">
        <div className="flex items-center gap-2">
          <span className="text-[#9dabb9] text-sm font-bold uppercase tracking-widest">System</span>
          <span className="text-[#9dabb9] text-sm">/</span>
          <span className="text-[#137fec] text-sm font-black uppercase tracking-widest">Master Navigation Map</span>
        </div>
        <div className="flex items-center gap-4">
           <div className="bg-[#1a242f] border border-[#283039] rounded px-3 py-1 flex items-center gap-2">
              <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              <span className="text-[10px] font-mono text-[#9dabb9] uppercase tracking-widest">System Operational</span>
           </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-12 scrollbar-hide relative z-10 pb-32">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-12">
          <div className="border-b border-[#283039] pb-8">
            <h1 className="text-white text-4xl font-black tracking-tighter uppercase mb-4">
              Master Navigation Map <span className="text-[#283039] mx-4">//</span> System Architecture
            </h1>
            <p className="text-[#9dabb9] text-lg font-medium max-w-3xl leading-relaxed">
              Unified interface for the ReadyLayer ecosystem. Access control planes, governance modules, and data artifacts across the platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
            {pillars.map((pillar) => (
              <div key={pillar.id} className="flex flex-col gap-6">
                 <div className="flex items-center justify-between border-b border-[#137fec]/30 pb-3">
                    <h2 className="text-white text-xs font-black tracking-[0.2em] uppercase flex items-center gap-2">
                       <span className="material-symbols-outlined text-[#137fec] text-lg">{pillar.icon}</span>
                       {pillar.id}. {pillar.title}
                    </h2>
                    <span className="text-[10px] font-mono text-slate-600 font-bold uppercase">{pillar.nodes.length} Modules</span>
                 </div>
                 
                 <div className="flex flex-col gap-4">
                    {pillar.nodes.map((node) => (
                      <Link 
                        key={node.name} 
                        href={node.path}
                        className="group relative bg-[#1a242f] hover:bg-[#222d3a] border border-[#283039] hover:border-[#137fec]/50 rounded-2xl p-6 transition-all duration-300 before:content-[''] before:absolute before:top-0 before:left-0 before:w-2 before:h-2 before:border-t-2 before:border-l-2 before:border-[#137fec] before:rounded-tl-lg before:opacity-0 group-hover:before:opacity-100 after:content-[''] after:absolute after:bottom-0 after:right-0 after:w-2 after:h-2 after:border-b-2 after:border-r-2 after:border-[#137fec] after:rounded-br-lg after:opacity-0 group-hover:after:opacity-100"
                      >
                         <div className="flex justify-between items-start mb-4">
                            <div className="font-mono text-[#137fec] text-[10px] font-black bg-[#137fec]/10 px-2 py-1 rounded border border-[#137fec]/20 tracking-tighter">{node.route}</div>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${node.access === 'Admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : node.access === 'Public' ? 'bg-blue-400/10 text-blue-300 border-blue-400/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                               {node.role}
                            </span>
                         </div>
                         <h3 className="text-white font-black text-sm uppercase tracking-widest group-hover:text-[#137fec] transition-colors">{node.name}</h3>
                         <p className="text-[#9dabb9] text-xs font-medium leading-relaxed mt-2 mb-6 group-hover:text-slate-300 transition-colors">{node.desc}</p>
                         <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-[#9dabb9] group-hover:text-white pt-4 border-t border-[#283039]/50">
                            <span>Open</span>
                            <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                         </div>
                      </Link>
                    ))}
                 </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
