/**
 * Exports Page - Demo view of export bundles and verification
 */

import { getDemoEngine } from '@/lib/demo-engine';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Exports | Reach OSS Demo',
  description: 'Export bundles, verification, and download links',
};

export default async function ExportsPage() {
  let bundle: Awaited<ReturnType<ReturnType<typeof getDemoEngine>['exportBundle']>> | null = null;
  let verification: { valid: boolean; details: string } | null = null;
  let error: string | null = null;

  try {
    const engine = getDemoEngine();
    const junctions = engine.getJunctions();
    if (junctions.length > 0) {
      bundle = await engine.exportBundle();
      verification = await engine.verifyBundle(bundle);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load exports';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Exports</h1>
              <p className="text-gray-600 mt-1">
                Export bundles with manifests and verification
              </p>
            </div>
            <a href="/demo" className="text-sm text-gray-600 hover:text-gray-900">
              ← Back to Demo
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {!bundle ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="text-4xl mb-4">📦</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Export Bundle</h3>
            <p className="text-gray-500 mb-6">
              Export bundles are created from the demo workflow
            </p>
            <a
              href="/demo"
              className="inline-flex items-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
            >
              Go to Demo Hub to Export Bundle
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Verification Status */}
            {verification && (
              <div className={`p-4 rounded-xl border ${
                verification.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{verification.valid ? '✅' : '❌'}</span>
                  <div>
                    <p className={`font-medium ${verification.valid ? 'text-green-800' : 'text-red-800'}`}>
                      Bundle {verification.valid ? 'Verified' : 'Verification Failed'}
                    </p>
                    <p className="text-sm text-gray-600">{verification.details}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Bundle Details */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Bundle Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Bundle ID</p>
                  <p className="text-sm font-mono text-gray-900 truncate">{bundle.id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Created</p>
                  <p className="text-sm text-gray-900">{new Date(bundle.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Fingerprint</p>
                  <p className="text-sm font-mono text-gray-900 truncate">{bundle.fingerprint}</p>
                </div>
              </div>
            </div>

            {/* Manifest */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Manifest</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500">Version</p>
                  <p className="text-sm text-gray-900">{bundle.manifest.version}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Engine Version</p>
                  <p className="text-sm text-gray-900">{bundle.manifest.engine_version}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Event Count</p>
                  <p className="text-sm text-gray-900">{bundle.manifest.event_count}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Tenant ID</p>
                  <p className="text-sm font-mono text-gray-900">{bundle.manifest.tenant_id}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-2">Checksums</p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  {Object.entries(bundle.manifest.checksums).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">{key}</span>
                      <span className="text-xs font-mono text-gray-900">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Contents Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <p className="text-3xl font-bold text-orange-600">{bundle.junctions.length}</p>
                <p className="text-sm font-medium text-gray-900 mt-1">Junctions</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <p className="text-3xl font-bold text-blue-600">{bundle.decisions.length}</p>
                <p className="text-sm font-medium text-gray-900 mt-1">Decisions</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <p className="text-3xl font-bold text-green-600">{bundle.events.length}</p>
                <p className="text-sm font-medium text-gray-900 mt-1">Events</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
