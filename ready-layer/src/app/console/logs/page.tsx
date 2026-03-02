/**
 * Console Logs Page - View and search event logs
 */
export default function ConsoleLogsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Event Logs</h1>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <p className="text-gray-600 dark:text-gray-300">
          View and search the immutable event log with prev-hash chain verification.
        </p>
      </div>
    </div>
  );
}
