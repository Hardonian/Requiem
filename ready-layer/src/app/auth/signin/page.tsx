import type { Metadata } from 'next';
import Link from 'next/link';
import { SignInForm } from './SignInForm';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Requiem account.',
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  const isRouteVerifyMode =
    process.env.REQUIEM_ROUTE_VERIFY_MODE === '1' && process.env.NODE_ENV !== 'production';
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
          <h1 className="text-xl font-bold text-foreground font-display">Sign in to Requiem</h1>
          <p className="mt-2 text-sm text-muted">
            Authentication is managed by your configured identity provider.
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
                <p className="text-sm font-semibold text-foreground">Authentication not configured</p>
                <p className="text-sm text-muted mt-1">
                  Supabase environment variables are missing. Authentication cannot proceed until the
                  identity provider is connected.
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

        {/* Configured: render real sign-in form */}
        {supabaseConfigured && <SignInForm />}

        {/* Dev verify mode notice */}
        {isRouteVerifyMode && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Route verify mode active — synthetic auth is enabled for local QA. Production
            authentication is unchanged.
          </div>
        )}

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
