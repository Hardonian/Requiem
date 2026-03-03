import type { Metadata } from 'next';
import { DriftScreen } from '@/components/screens/drift/DriftScreen';

export const metadata: Metadata = {
  title: 'Drift',
  description: 'Monitor vector drift and fingerprint divergence.',
};

export default function DriftPage() {
  return <DriftScreen />;
}
