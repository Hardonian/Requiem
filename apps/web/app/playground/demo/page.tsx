/**
 * Demo Hub - Guided Demo Experience for Reach OSS
 * 
 * This is the main entry point for the demo experience.
 * It provides a step-by-step guided tour of the Reach suite capabilities.
 */

import { DemoClient } from './DemoClient';

export const metadata = {
  title: 'Demo | Reach OSS',
  description: 'Experience the Reach decision engine suite end-to-end',
};

export default function DemoPage() {
  return <DemoClient />;
}
