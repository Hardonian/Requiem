'use client';

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-red-700">Evidence Viewer unavailable</h1>
        <p className="mt-2 text-sm text-gray-700">The page encountered an error, but your run data is safe. Retry or return to the demo hub.</p>
        <div className="mt-4 flex gap-2">
          <button className="rounded bg-gray-900 px-3 py-2 text-sm text-white" onClick={reset}>Retry</button>
          <a className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700" href="/demo">Back to demo</a>
        </div>
      </div>
    </main>
  );
}
