'use client';

/**
 * CopyButton - Reusable copy-to-clipboard component
 * 
 * Provides visual feedback when content is copied.
 */

import { useState, useCallback } from 'react';

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function CopyButton({ text, label = 'Copy', className = '', size = 'sm' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail - clipboard may not be available
    }
  }, [text]);

  const sizeClasses = size === 'sm' 
    ? 'p-1' 
    : 'px-3 py-1.5 text-sm';

  return (
    <button
      onClick={handleCopy}
      className={`
        inline-flex items-center gap-1.5 
        text-gray-500 dark:text-gray-400 
        hover:text-emerald-600 dark:hover:text-emerald-400
        transition-colors rounded
        focus:outline-none focus:ring-2 focus:ring-emerald-500/20
        ${sizeClasses}
        ${className}
      `}
      title={copied ? 'Copied!' : `Copy ${label}`}
      type="button"
    >
      {copied ? (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {size === 'md' && <span>{label}</span>}
        </>
      )}
    </button>
  );
}
