import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact | ReadyLayer Support',
  description: 'Contact the ReadyLayer team for help, feedback, or sales inquiries.',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Contact Us</h1>
        
        <div className="bg-white rounded-xl p-8 shadow-sm">
          <p className="text-gray-600 mb-8">
            Have a question, feedback, or need help? We&apos;d love to hear from you.
          </p>
          
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Email</h2>
              <p className="text-gray-600">support@readylayer.com</p>
            </div>
            
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Sales</h2>
              <p className="text-gray-600">sales@readylayer.com</p>
            </div>
            
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">General Inquiries</h2>
              <p className="text-gray-600">hello@readylayer.com</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
