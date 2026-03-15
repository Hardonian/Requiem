/**
 * UI Components - Shared design system components
 * 
 * These components provide consistent UI patterns across the console:
 * - CopyButton: Copy-to-clipboard with feedback
 * - HashDisplay: Cryptographic hash display with shortening
 * - JsonViewer: Expandable JSON with syntax highlighting
 * - ErrorDisplay: Consistent error envelopes
 * - VerificationBadge: Trust/verification status
 * - PageHeader: Consistent page headers with What/Why/Action
 */

export { CopyButton } from './CopyButton';
export { HashDisplay, HashRow } from './HashDisplay';
export { JsonViewer } from './JsonViewer';
export { 
  ErrorDisplay, 
  BudgetErrorDisplay, 
  CapabilityErrorDisplay 
} from './ErrorDisplay';
export { VerificationBadge } from './VerificationBadge';
export { 
  PageHeader, 
  SectionHeader, 
  LoadingState, 
  EmptyState 
} from './PageHeader';

export { RouteMaturityNote } from './RouteMaturityNote';
export { OperationalTruthBanner } from './OperationalTruthBanner';
export { ProtectedRouteShell } from './ProtectedRouteShell';
