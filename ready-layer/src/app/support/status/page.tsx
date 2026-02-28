import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'System Status | ReadyLayer',
  description: 'Current system status and availability for ReadyLayer services.',
};

const services = [
  { name: 'API', status: 'operational', description: 'Core API endpoints' },
  { name: 'CLI', status: 'operational', description: 'Command-line tools' },
  { name: 'Dashboard', status: 'operational', description: 'Web dashboard' },
  { name: 'Replay Engine', status: 'operational', description: 'Deterministic replay system' },
  { name: 'Policy Engine', status: 'operational', description: 'Policy evaluation service' },
];

export default function StatusPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">System Status</h1>
        
        <div className="bg-white rounded-xl p-8 shadow-sm mb-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            <span className="text-xl font-semibold text-gray-900">All Systems Operational</span>
          </div>
          
          <div className="space-y-4">
            {services.map((service) => (
              <div key={service.name} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div>
                  <h3 className="font-medium text-gray-900">{service.name}</h3>
                  <p className="text-sm text-gray-500">{service.description}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm ${
                  service.status === 'operational' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {service.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Incidents</h2>
          <p className="text-gray-600">No recent incidents to report.</p>
        </div>
      </div>
    </div>
  );
}
