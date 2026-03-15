'use client';

interface TruthActionButtonProps {
  label: string;
  onClick: () => void;
  pending?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  semantics:
    | 'runtime-backed'
    | 'local-only'
    | 'navigation-only'
    | 'informational'
    | 'dialog-only'
    | 'dev-verify-only';
}

const semanticsCopy: Record<TruthActionButtonProps['semantics'], string> = {
  'runtime-backed': 'Requires a connected backend',
  'local-only': 'Local action — no backend call',
  'navigation-only': 'Navigates to another page',
  informational: 'Displays information only',
  'dialog-only': 'Opens a local dialog',
  'dev-verify-only': 'Available in dev/QA mode only',
};

export function TruthActionButton({
  label,
  onClick,
  pending = false,
  disabled = false,
  disabledReason,
  semantics,
}: TruthActionButtonProps) {
  const unavailable = disabled || pending;
  // Hide dev-only semantics note in production to avoid surfacing internal jargon
  const isDev = process.env.NODE_ENV !== 'production';
  const showSemanticsHint = isDev && !unavailable;

  return (
    <div className="space-y-1" aria-live="polite" aria-atomic="true">
      <button
        type="button"
        onClick={onClick}
        disabled={unavailable}
        aria-disabled={unavailable}
        aria-busy={pending}
        title={disabledReason}
        className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 transition-opacity"
      >
        {pending && (
          <svg
            className="animate-spin h-3.5 w-3.5 text-white/80"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        <span>{pending ? `${label}…` : label}</span>
      </button>
      {(unavailable && disabledReason) || showSemanticsHint ? (
        <p className="text-xs text-muted">
          {unavailable && disabledReason
            ? `Unavailable: ${disabledReason}.`
            : showSemanticsHint
              ? semanticsCopy[semantics]
              : null}
        </p>
      ) : null}
    </div>
  );
}
