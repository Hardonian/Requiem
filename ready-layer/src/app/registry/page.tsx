import type { Metadata } from 'next';
import { RegistryScreen } from '@/components/screens/registry/RegistryScreen';

export const metadata: Metadata = {
  title: 'Registry',
  description: 'Browse package and object registry digests.',
};

export default function RegistryPage() {
  return <RegistryScreen />;
}
