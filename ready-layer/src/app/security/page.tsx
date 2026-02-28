import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security | Requiem',
  description: 'Security practices, vulnerability disclosure, and trust information for Requiem.',
};

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Security</h1>
        
        <section className="bg-white rounded-xl p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Responsible Disclosure</h2>
          <p className="text-gray-600 mb-4">
            We take security seriously. If you discover a security vulnerability in Requiem, 
            please report it responsibly.
          </p>
          <p className="text-gray-600">
            Please email security@requiem.ai with details of the vulnerability. 
            We will respond within 48 hours and work with you to address the issue.
          </p>
        </section>

        <section className="bg-white rounded-xl p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Security Features</h2>
          <ul className="space-y-3 text-gray-600">
            <li>• Deterministic replay for complete audit trails</li>
            <li>• Tenant isolation for multi-tenant deployments</li>
            <li>• Policy enforcement at every execution step</li>
            <li>• Signed artifacts and cryptographic verification</li>
            <li>• SOC 2 compliance ready</li>
          </ul>
        </section>

        <section className="bg-white rounded-xl p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Infrastructure Security</h2>
          <p className="text-gray-600">
            Requiem runs on isolated, encrypted infrastructure with regular security audits 
            and automated vulnerability scanning.
          </p>
        </section>
      </div>
    </div>
  );
}
