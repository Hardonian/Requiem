'use client';

/**
 * ErrorDisplay - Consistent error envelope presentation
 * 
 * Displays errors with:
 * - Error code (machine-readable)
 * - Human-readable message
 * - Trace ID for debugging
 * - "Copy debug info" button (hides stack traces)
 * 
 * NEVER displays raw stack traces in UI.
 */

import { CopyButton } from './CopyButton';

interface ErrorDisplayProps {
  code: string;
  message: string;
  traceId?: string;
  hint?: string;
  action?: {
    label: string;
    href: string;
  };
  onRetry?: () => void;
  className?: string;
}

export function ErrorDisplay({
  code,
  message,
  traceId,
  hint,
  action,
  onRetry,
  className = ''
}: ErrorDisplayProps) {
  const debugInfo = JSON.stringify({
    code,
    message,
    traceId,
    timestamp: new Date().toISOString(),
  }, null, 2);

  return (
    <div 
      className={`
        rounded-lg border p-4 
        bg-red-50 dark:bg-red-900/10 
        border-red-200 dark:border-red-800
        ${className}
      `}
      role="alert"
    >
      {/* Error Header */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg 
            className="w-5 h-5 text-red-500" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </div>
        
        <div className="flex-1 min-w-0">
          {/* Error Code */}
          <div className="flex items-center gap-2 mb-1">
            <code className="text-xs font-mono text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
              {code}
            </code>
            {traceId && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Trace: {traceId.substring(0, 16)}...
              </span>
            )}
          </div>
          
          {/* Message */}
          <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
            {message}
          </h3>
          
          {/* Hint */}
          {hint && (
            <p className="mt-2 text-sm text-red-600/80 dark:text-red-400/80">
              {hint}
            </p>
          )}
          
          {/* Actions */}
          <div className="mt-3 flex items-center gap-3">
            <CopyButton 
              text={debugInfo} 
              label="debug info" 
              size="md"
              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            />
            
            {action && (
              <a
                href={action.href}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline underline-offset-2"
              >
                {action.label}
              </a>
            )}
            
            {onRetry && (
              <button
                onClick={onRetry}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline underline-offset-2"
                type="button"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * BudgetError - Specialized error display for budget denials
 */
interface BudgetErrorProps {
  limitName: string;
  currentUsage: number;
  limit: number;
  unit?: string;
  onViewFinOps?: () => void;
  className?: string;
}

export function BudgetErrorDisplay({
  limitName,
  currentUsage,
  limit,
  unit = 'units',
  onViewFinOps,
  className = ''
}: BudgetErrorProps) {
  const percent = Math.min(100, (currentUsage / limit) * 100);
  const isOverLimit = currentUsage > limit;

  return (
    <ErrorDisplay
      code="E_BUDGET_EXCEEDED"
      message={`${limitName} budget limit exceeded`}
      hint={`You've used ${currentUsage.toLocaleString()} of ${limit.toLocaleString()} ${unit}. ${isOverLimit ? 'Limit exceeded by ' + (currentUsage - limit).toLocaleString() : 'At ' + percent.toFixed(0) + '% of limit.'}`}
      action={onViewFinOps ? { label: 'View FinOps →', href: '/console/finops' } : undefined}
      className={className}
    />
  );
}

/**
 * CapabilityError - Specialized error display for capability denials
 */
interface CapabilityErrorProps {
  requiredScope: string;
  providedScopes: string[];
  className?: string;
}

export function CapabilityErrorDisplay({
  requiredScope,
  providedScopes,
  className = ''
}: CapabilityErrorProps) {
  return (
    <ErrorDisplay
      code="E_CAPABILITY_DENIED"
      message="Insufficient capability scope"
      hint={`Required: ${requiredScope}. Provided: ${providedScopes.join(', ') || 'none'}. Use 'reach caps mint' to create a capability with the required scope.`}
      className={className}
    />
  );
}
