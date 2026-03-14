import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Requiem account.',
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-10 h-10 bg-foreground rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-background font-bold text-sm">R</span>
          </div>
          <h1 className="text-xl font-bold text-foreground font-display">Sign in to Requiem</h1>
          <p className="mt-2 text-sm text-muted">
            Authentication is managed by your configured identity provider.
          </p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-6 shadow-sm">
          <p className="text-sm text-muted text-center">
            Connect your Supabase identity provider to enable authentication.
          </p>
        </div>
        <p className="text-center mt-6 text-sm text-muted">
          Need an account?{' '}
          <Link href="/auth/signup" className="text-accent hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
