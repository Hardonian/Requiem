'use client';

/**
 * HashDisplay - Consistent hash display with shortening and copy functionality
 * 
 * Displays cryptographic hashes in a readable format with:
 * - Automatic shortening with ellipsis
 * - One-click copy to clipboard
 * - Monospace font for readability
 */

import { CopyButton } from './CopyButton';

interface HashDisplayProps {
  hash: string;
  length?: number;
  showCopy?: boolean;
  className?: string;
  label?: string;
}

export function HashDisplay({ 
  hash, 
  length = 16, 
  showCopy = true,
  className = '',
  label
}: HashDisplayProps) {
  if (!hash) return <span className="text-gray-400">-</span>;

  const shortened = hash.length > length 
    ? `${hash.substring(0, length)}...`
    : hash;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {label && (
        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </span>
      )}
      <code 
        className="font-mono text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded"
        title={hash}
      >
        {shortened}
      </code>
      {showCopy && <CopyButton text={hash} label="hash" size="sm" />}
    </div>
  );
}

/**
 * HashRow - Displays a labeled hash field in a row layout
 */
interface HashRowProps {
  label: string;
  hash: string;
  length?: number;
}

export function HashRow({ label, hash, length = 24 }: HashRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <HashDisplay hash={hash} length={length} />
    </div>
  );
}
