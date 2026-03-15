import { redirect } from 'next/navigation';

/**
 * /runs redirects to the authoritative console runs view.
 * The console runs page (/console/runs) is the canonical execution history surface.
 */
export default function RunsPage() {
  redirect('/console/runs');
}
