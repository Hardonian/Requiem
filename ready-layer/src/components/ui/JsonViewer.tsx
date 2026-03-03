'use client';

/**
 * JsonViewer - Expandable JSON display with syntax highlighting
 * 
 * Features:
 * - Collapsed by default for large payloads
 * - Syntax highlighting for keys, strings, numbers, booleans
 * - Copy to clipboard functionality
 * - Size limit warning for very large payloads
 */

import { useState, useMemo } from 'react';
import { CopyButton } from './CopyButton';

interface JsonViewerProps {
  data: unknown;
  title?: string;
  initiallyExpanded?: boolean;
  maxPreviewLines?: number;
  className?: string;
}

const MAX_SAFE_SIZE = 100000; // 100KB

export function JsonViewer({ 
  data, 
  title,
  initiallyExpanded = false,
  maxPreviewLines = 5,
  className = ''
}: JsonViewerProps) {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);

  const { jsonString, isLarge } = useMemo(() => {
    const str = JSON.stringify(data, null, 2);
    return {
      jsonString: str,
      isLarge: str.length > MAX_SAFE_SIZE
    };
  }, [data]);

  const previewLines = useMemo(() => {
    const lines = jsonString.split('\n');
    return lines.slice(0, maxPreviewLines).join('\n');
  }, [jsonString, maxPreviewLines]);

  const lineCount = useMemo(() => jsonString.split('\n').length, [jsonString]);
  const shouldCollapse = lineCount > maxPreviewLines;

  if (!data) return <span className="text-gray-400 italic">null</span>;

  return (
    <div className={`bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 rounded-t-lg">
        <div className="flex items-center gap-2">
          {shouldCollapse && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              type="button"
            >
              <svg 
                className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {title || 'JSON'}
          </span>
          <span className="text-xs text-gray-400">
            ({lineCount} lines, {(jsonString.length / 1024).toFixed(1)} KB)
          </span>
        </div>
        <CopyButton text={jsonString} label="JSON" size="sm" />
      </div>

      {/* Content */}
      <div className="p-4 overflow-x-auto">
        {isLarge && !isExpanded && (
          <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-700 dark:text-yellow-400">
            Large payload ({(jsonString.length / 1024).toFixed(0)} KB). 
            Click expand to view full content.
          </div>
        )}
        
        <pre className="text-sm font-mono leading-relaxed">
          <code>
            {isExpanded || !shouldCollapse ? (
              <SyntaxHighlighted json={jsonString} />
            ) : (
              <>
                <SyntaxHighlighted json={previewLines} />
                <span className="text-gray-400">\n... ({lineCount - maxPreviewLines} more lines)</span>
              </>
            )}
          </code>
        </pre>
      </div>
    </div>
  );
}

/**
 * SyntaxHighlighted - Simple JSON syntax highlighting
 */
function SyntaxHighlighted({ json }: { json: string }) {
  // Simple regex-based syntax highlighting
  const tokens = json.split(/("(?:[^"\\]|\\.)*")|(\b(?:true|false|null)\b)|(\b\d+(?:\.\d+)?\b)|([{}[\],:])/g);
  
  return (
    <>
      {tokens.map((token, i) => {
        if (!token) return null;
        
        // String (key or value)
        if (token.startsWith('"')) {
          const isKey = token.endsWith('":') || token.endsWith('" :');
          return (
            <span 
              key={i} 
              className={isKey ? 'text-purple-600 dark:text-purple-400' : 'text-green-600 dark:text-green-400'}
            >
              {token}
            </span>
          );
        }
        
        // Boolean/null
        if (/^(true|false|null)$/.test(token)) {
          return (
            <span key={i} className="text-blue-600 dark:text-blue-400">
              {token}
            </span>
          );
        }
        
        // Number
        if (/^\d+(?:\.\d+)?$/.test(token)) {
          return (
            <span key={i} className="text-orange-600 dark:text-orange-400">
              {token}
            </span>
          );
        }
        
        // Punctuation/brackets
        if (/^[{}[\],:]$/.test(token)) {
          return (
            <span key={i} className="text-gray-500 dark:text-gray-500">
              {token}
            </span>
          );
        }
        
        // Default (whitespace, etc)
        return <span key={i}>{token}</span>;
      })}
    </>
  );
}
