import Link from 'next/link';

export default function SignUpPage() {
  return <main className="mx-auto max-w-md px-6 py-16"><h1 className="text-2xl font-semibold">Sign up</h1><p className="mt-3 text-slate-600">Create your ReadyLayer tenant and connect an identity provider.</p><Link href="/auth/signin" className="mt-6 inline-block text-emerald-700 hover:underline">Already have an account? Sign in</Link></main>;
}
