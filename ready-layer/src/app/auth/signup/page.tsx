import type { Metadata } from 'next';
import Link from 'next/link';
import { SignUpForm } from './SignUpForm';

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create your Requiem account and tenant.',
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-10 h-10 bg-foreground rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-background font-bold text-sm">R</span>
          </div>
          <h1 className="text-xl font-bold text-foreground font-display">Create your account</h1>
          <p className="mt-2 text-sm text-muted">
            Set up your ReadyLayer tenant and connect an identity provider.
          </p>
        </div>

        {/* Setup required notice */}
        {!supabaseConfigured && (
          <div
            className="bg-surface rounded-xl border border-border p-6 shadow-sm space-y-4"
            role="alert"
            aria-label="Authentication setup required"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                <svg
                  className="w-4 h-4 text-warning"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Tenant provisioning not configured</p>
                <p className="text-sm text-muted mt-1">
                  Sign-up requires a connected Supabase project. Configure the environment variables
                  below to enable tenant provisioning.
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-surface-elevated border border-border p-4 space-y-2">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">
                Required environment variables
              </p>
              <div className="space-y-1 font-mono text-xs text-foreground">
                <div>
                  <code className="bg-background px-1.5 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_URL</code>
                </div>
                <div>
                  <code className="bg-background px-1.5 py-0.5 rounded">
                    NEXT_PUBLIC_SUPABASE_ANON_KEY
                  </code>
                </div>
              </div>
            </div>

            <a
              href="/docs"
              className="flex items-center justify-center gap-1.5 text-sm font-medium text-accent hover:underline"
            >
              Authentication setup guide
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        )}

        {/* Configured: render real sign-up form */}
        {supabaseConfigured && <SignUpForm />}

        <p className="text-center mt-6 text-sm text-muted">
          Already have an account?{' '}
          <Link href="/auth/signin" className="text-accent hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
