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
  'runtime-backed': 'runtime-backed action',
  'local-only': 'local-only action',
  'navigation-only': 'navigation only',
  informational: 'informational control',
  'dialog-only': 'opens local dialog/panel only',
  'dev-verify-only': 'dev-verify-only action (synthetic auth context)',
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

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onClick}
        disabled={unavailable}
        aria-disabled={unavailable}
        title={disabledReason}
        className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? `${label}…` : label}
      </button>
      <p className="text-xs text-muted">
        {unavailable && disabledReason ? `Unavailable: ${disabledReason}.` : `Semantics: ${semanticsCopy[semantics]}.`}
      </p>
    </div>
  );
}
