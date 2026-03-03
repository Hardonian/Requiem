import type { Metadata } from 'next';
import { SpendScreen } from '@/components/screens/spend/SpendScreen';

export const metadata: Metadata = {
  title: 'Spend',
  description: 'Track budgets, burn rate, and policy pressure.',
};

export default function SpendPage() {
  return <SpendScreen />;
}
