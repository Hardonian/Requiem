import Link from 'next/link';

export default function SignInPage() {
  return <main className="mx-auto max-w-md px-6 py-16"><h1 className="text-2xl font-semibold">Sign in</h1><p className="mt-3 text-slate-600">Authentication is managed by configured Supabase identity providers.</p><Link href="/auth/signup" className="mt-6 inline-block text-emerald-700 hover:underline">Need an account? Sign up</Link></main>;
}
