'use client';

/**
 * VerificationBadge - Trust/verifiability visibility component
 * 
 * Displays verification status with clear visual indicators:
 * - Verified: Green checkmark
 * - Failed: Red X with explanation
 * - Pending: Yellow spinner
 */

interface VerificationBadgeProps {
  key?: string;
  status: 'verified' | 'failed' | 'pending' | 'unknown';
  message?: string;
  details?: string;
  onVerify?: () => void;
  className?: string;
}

export function VerificationBadge({
  status,
  message,
  details,
  onVerify,
  className = ''
}: VerificationBadgeProps) {
  const config = {
    verified: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-700 dark:text-green-400',
      icon: (
        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      defaultMessage: 'Verification passed',
      showButton: true,
      buttonText: 'Verify Again'
    },
    failed: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-700 dark:text-red-400',
      icon: (
        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      defaultMessage: 'Verification failed',
      showButton: true,
      buttonText: 'Verify'
    },
    pending: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      text: 'text-yellow-700 dark:text-yellow-400',
      icon: (
        <svg className="w-5 h-5 text-yellow-500 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ),
      defaultMessage: 'Verifying...',
      showButton: false,
      buttonText: ''
    },
    unknown: {
      bg: 'bg-gray-50 dark:bg-gray-800',
      border: 'border-gray-200 dark:border-gray-700',
      text: 'text-gray-600 dark:text-gray-400',
      icon: (
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      defaultMessage: 'Not verified',
      showButton: false,
      buttonText: ''
    }
  };

  const style = config[status];

  return (
    <div 
      className={`
        rounded-lg border p-4 
        ${style.bg} ${style.border}
        ${className}
      `}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {style.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-medium ${style.text}`}>
            {message || style.defaultMessage}
          </h4>
          {details && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {details}
            </p>
          )}
        </div>
        {onVerify && style.showButton && (
          <button
            onClick={onVerify}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-md
              transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
              ${status === 'verified' 
                ? 'bg-green-100 text-green-700 hover:bg-green-200 focus:ring-green-500 dark:bg-green-900/30 dark:text-green-400' 
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-emerald-500'
              }
            `}
            type="button"
          >
            {style.buttonText}
          </button>
        )}
      </div>
    </div>
  );
}
