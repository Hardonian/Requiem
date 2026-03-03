import type { Metadata } from 'next';
import { SettingsScreen } from '@/components/screens/settings/SettingsScreen';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Theme, account, and tenant preferences.',
};

export default function SettingsPage() {
  return <SettingsScreen />;
}
