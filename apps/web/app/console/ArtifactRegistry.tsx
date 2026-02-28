'use client';

import React, { useState } from 'react';

type RetentionTier = 'short' | 'standard' | 'extended';

interface Artifact {
  name: string;
  type: string;
  size: string;
  status: 'Signed' | 'Unsigned' | 'Expired';
  created: string;
  hash: string;
  retentionTier: RetentionTier;
  retentionDays: number;
  expiresAt: string | null;
  expired: boolean;
}

const RETENTION_LABELS: Record<RetentionTier, { label: string; days: number; color: string }> = {
  short: { label: '7d', days: 7, color: 'slate' },
  standard: { label: '30d', days: 30, color: 'blue' },
  extended: { label: '90d', days: 90, color: 'purple' },
};

const artifacts: Artifact[] = [
  { name: 'agent-pack-v2.4.0.tar.gz', type: 'Agent Pack', size: '14.2 MB', status: 'Signed', created: '2h ago', hash: 'sha256:a3f1...b92e', retentionTier: 'extended', retentionDays: 90, expiresAt: '2026-05-22', expired: false },
  { name: 'eval-dataset-jan.parquet', type: 'Dataset', size: '842 MB', status: 'Unsigned', created: '1d ago', hash: 'sha256:c7a9...d01f', retentionTier: 'standard', retentionDays: 30, expiresAt: '2026-03-23', expired: false },
  { name: 'runner-snapshot-prod.img', type: 'Runner Image', size: '2.1 GB', status: 'Signed', created: '3d ago', hash: 'sha256:f82b...7c44', retentionTier: 'extended', retentionDays: 90, expiresAt: '2026-05-20', expired: false },
  { name: 'governance-policy-v3.json', type: 'Policy Bundle', size: '48 KB', status: 'Signed', created: '5d ago', hash: 'sha256:09e3...a15d', retentionTier: 'short', retentionDays: 7, expiresAt: '2026-02-13', expired: true },
  { name: 'test-fixtures-archive.zip', type: 'Dataset', size: '128 MB', status: 'Expired', created: '45d ago', hash: 'sha256:b4e7...c89a', retentionTier: 'short', retentionDays: 7, expiresAt: '2026-01-14', expired: true },
];

const statusColor: Record<string, string> = {
  Signed: 'emerald',
  Unsigned: 'amber',
  Expired: 'red',
};

export function ArtifactRegistry() {
  const [showExpired, setShowExpired] = useState(false);
  const [filterTier, setFilterTier] = useState<RetentionTier | 'all'>('all');

  const filtered = artifacts
    .filter(a => showExpired || !a.expired)
    .filter(a => filterTier === 'all' || a.retentionTier === filterTier);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#101622] font-sans">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[#282e39] bg-[#111318] px-10 py-5">
        <div className="flex flex-col">
          <h2 className="text-lg font-black uppercase tracking-widest text-[#135bec]">Artifact Registry</h2>
          <p className="text-[#9da6b9] text-[10px] font-bold uppercase tracking-wide">Signed build outputs, snapshots & policy bundles</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20"
          >
            <span className="material-symbols-outlined text-[18px]">upload</span>
            Upload Artifact
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 md:p-12 max-w-[1600px] mx-auto w-full flex flex-col gap-10">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Total Artifacts', value: String(artifacts.length), color: 'blue' },
            { label: 'Signed', value: String(artifacts.filter(a => a.status === 'Signed').length), color: 'emerald' },
            { label: 'Expired', value: String(artifacts.filter(a => a.expired).length), color: 'red' },
            { label: 'Storage Used', value: '18.7 GB', color: 'slate' },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#1e293b] rounded-2xl border border-slate-700/50 p-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#9da6b9] mb-2">{stat.label}</p>
              <p className={`text-3xl font-black text-${stat.color}-400`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
            <input
              type="text"
              placeholder="Search artifacts by name, hash, or type..."
              className="w-full bg-[#1e293b] border border-slate-700/50 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#135bec]"
            />
          </div>
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value as RetentionTier | 'all')}
            className="bg-[#1e293b] border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-[#9da6b9] focus:outline-none focus:ring-1 focus:ring-[#135bec]"
            aria-label="Filter by retention tier"
          >
            <option value="all">All Tiers</option>
            <option value="short">Short (7d)</option>
            <option value="standard">Standard (30d)</option>
            <option value="extended">Extended (90d)</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-[#9da6b9] cursor-pointer">
            <input type="checkbox" checked={showExpired} onChange={(e) => setShowExpired(e.target.checked)} className="rounded" />
            Show expired
          </label>
        </div>

        {/* Artifact Table */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-700/50 overflow-hidden">
          <table className="w-full text-left font-sans">
            <thead className="bg-[#111318] text-[10px] font-black uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-8 py-4">Name</th>
                <th className="px-8 py-4">Type</th>
                <th className="px-8 py-4">Size</th>
                <th className="px-8 py-4">Signature</th>
                <th className="px-8 py-4">Retention</th>
                <th className="px-8 py-4">Expires</th>
                <th className="px-8 py-4">Hash</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-8 py-12 text-center text-slate-500">
                    <span className="material-symbols-outlined text-[32px] mb-2 block">inventory_2</span>
                    No artifacts match the current filters.
                  </td>
                </tr>
              )}
              {filtered.map((artifact) => {
                const color = statusColor[artifact.status] ?? 'slate';
                const tier = RETENTION_LABELS[artifact.retentionTier];
                return (
                  <tr key={artifact.name} className={`hover:bg-white/5 transition-colors group ${artifact.expired ? 'opacity-60' : ''}`}>
                    <td className="px-8 py-5 font-mono text-white text-[11px]">
                      {artifact.name}
                      {artifact.expired && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                          expired
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-5 text-[#9da6b9] font-bold uppercase tracking-widest text-[10px]">{artifact.type}</td>
                    <td className="px-8 py-5 text-[#9da6b9]">{artifact.size}</td>
                    <td className="px-8 py-5">
                      <span className={`px-2 py-0.5 rounded-full font-black uppercase tracking-widest text-[9px] bg-${color}-500/10 text-${color}-400 border border-${color}-500/20`}>
                        {artifact.status}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`px-2 py-0.5 rounded font-bold uppercase tracking-widest text-[9px] bg-${tier.color}-500/10 text-${tier.color}-400 border border-${tier.color}-500/20`}>
                        {tier.label}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-[#9da6b9] text-[10px] font-mono">
                      {artifact.expiresAt ?? '—'}
                    </td>
                    <td className="px-8 py-5 font-mono text-slate-500 text-[10px]">{artifact.hash}</td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          disabled={artifact.expired}
                          className="text-slate-400 hover:text-white p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                          title={artifact.expired ? 'Artifact expired — download unavailable' : 'Download'}
                        >
                          <span className="material-symbols-outlined text-[18px]">download</span>
                        </button>
                        <button
                          type="button"
                          className="text-slate-400 hover:text-red-400 p-1"
                          title="Delete (admin only)"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
