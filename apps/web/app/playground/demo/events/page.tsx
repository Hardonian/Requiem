/**
 * Events Page - Demo view of event tail and replay controls
 */

import { getDemoEngine } from '@/lib/demo-engine';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Events | Reach OSS Demo',
  description: 'View event tail, filters, and replay controls',
};

export default async function EventsPage() {
  let events: Awaited<ReturnType<ReturnType<typeof getDemoEngine>['getEvents']>> = [];
  let error: string | null = null;

  try {
    const engine = getDemoEngine();
    events = engine.getEvents();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load events';
  }

  const eventTypeColors: Record<string, string> = {
    junction: 'bg-orange-100 text-orange-700',
    decision: 'bg-blue-100 text-blue-700',
    action: 'bg-green-100 text-green-700',
    system: 'bg-gray-100 text-gray-700',
    artifact: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Events</h1>
              <p className="text-gray-600 mt-1">
                Event tail with filters and replay controls
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

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {['junction', 'decision', 'action', 'system', 'artifact'].map((type) => {
            const count = events.filter(e => e.type === type).length;
            return (
              <div key={type} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className="text-sm text-gray-500 capitalize">{type}</p>
              </div>
            );
          })}
        </div>

        {events.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="text-4xl mb-4">📡</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Events Yet</h3>
            <p className="text-gray-500 mb-6">
              Events are generated as junctions, decisions, and actions are processed
            </p>
            <a
              href="/demo"
              className="inline-flex items-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
            >
              Go to Demo Hub to Generate Events
            </a>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-medium text-gray-700">
                {events.length} events (newest first)
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {[...events].reverse().map((event) => (
                <div key={event.id} className="px-6 py-4 flex items-start gap-4">
                  <span className={`flex-shrink-0 px-2 py-1 text-xs rounded-full font-medium ${
                    eventTypeColors[event.type] || 'bg-gray-100 text-gray-700'
                  }`}>
                    {event.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-gray-900 truncate">{event.id}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Source: {event.source_id}
                    </p>
                  </div>
                  <p className="flex-shrink-0 text-xs text-gray-400">
                    {new Date(event.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
