import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Transparency | Requiem',
  description: 'Transparency report and governance information for Requiem.',
};

export default function TransparencyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Transparency</h1>
        
        <section className="bg-white rounded-xl p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Open Source Commitment</h2>
          <p className="text-gray-600 mb-4">
            Requiem is committed to transparency in AI governance. Our core technologies 
            are open source, including:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>Determinism engine for reproducible AI behavior</li>
            <li>Policy engine for governance controls</li>
            <li>Replay system for audit trails</li>
            <li>Provider SDK for multi-model support</li>
          </ul>
        </section>

        <section className="bg-white rounded-xl p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Decision Audit Trails</h2>
          <p className="text-gray-600">
            Every AI decision made through Requiem is logged with full context, 
            enabling complete auditability and accountability.
          </p>
        </section>

        <section className="bg-white rounded-xl p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Governance Transparency</h2>
          <p className="text-gray-600">
            We publish regular transparency reports on system usage, policy enforcement, 
            and any incidents. Our governance model is designed to be auditable by all stakeholders.
          </p>
        </section>
      </div>
    </div>
  );
}
