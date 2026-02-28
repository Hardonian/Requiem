import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Support | ReadyLayer',
  description: 'Get help with ReadyLayer — contact support, check status, and find resources.',
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Support</h1>
        
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <Link
            href="/support/contact"
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Contact Us</h2>
            <p className="text-gray-600">
              Get in touch with our team for help, feedback, or sales inquiries.
            </p>
          </Link>
          
          <Link
            href="/support/status"
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold text-gray-900 mb-2">System Status</h2>
            <p className="text-gray-600">
              Check the current status of ReadyLayer services and any ongoing incidents.
            </p>
          </Link>
        </div>

        <section className="bg-white rounded-xl p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Common Questions</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900">How do I get started?</h3>
              <p className="text-gray-600">Check our quick start guide in the library.</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">How does deterministic replay work?</h3>
              <p className="text-gray-600">Read our architecture documentation for details.</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">What providers are supported?</h3>
              <p className="text-gray-600">We support OpenAI, Anthropic, Ollama, and OpenRouter.</p>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Community</h2>
          <p className="text-gray-600">
            Join our community to connect with other ReadyLayer users, share best practices, 
            and get help from the community.
          </p>
        </section>
      </div>
    </div>
  );
}
