/**
 * @fileoverview Web IDE Bridge — ExecutionTrace panel.
 *
 * Visualization-only component. NEVER executes client-side.
 * Displays the execution envelope from Requiem's AI control plane.
 *
 * Shows:
 * - Replay hash (content-addressable)
 * - Model cost breakdown
 * - Execution trace (spans)
 * - Determinism flag
 * - Diff view (for kilo.execute results)
 */

import * as React from 'react';

// ─── Types (mirror of ExecutionEnvelope) ─────────────────────────────────────

export interface TraceSpan {
  spanId: string;
  name: string;
  traceId: string;
  startMs: number;
  endMs: number;
  attributes: Record<string, unknown>;
  status: 'ok' | 'error' | 'pending';
}

export interface ExecutionTrace {
  hash: string;
  toolName: string;
  toolVersion: string;
  tenantId: string;
  requestId: string;
  deterministic: boolean;
  fromCache: boolean;
  durationMs: number;
  result: unknown;
  spans: TraceSpan[];
  modelCost?: {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costCents: number;
  };
  diff?: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HashBadge({ hash, label }: { hash: string; label?: string }) {
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280', display: 'flex', gap: 4, alignItems: 'center' }}>
      <span style={{ color: '#9ca3af', textTransform: 'uppercase', fontSize: 9 }}>{label ?? 'hash'}</span>
      <span title={hash}>{hash.slice(0, 16)}…</span>
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 9999,
      fontSize: 11,
      fontWeight: 600,
      backgroundColor: ok ? '#d1fae5' : '#fee2e2',
      color: ok ? '#065f46' : '#991b1b',
    }}>
      {label}
    </span>
  );
}

function DiffViewer({ diff }: { diff: string }) {
  const lines = diff.split('\n');
  return (
    <pre style={{
      fontFamily: 'monospace',
      fontSize: 11,
      background: '#111827',
      color: '#f9fafb',
      padding: 12,
      borderRadius: 6,
      overflow: 'auto',
      maxHeight: 300,
    }}>
      {lines.map((line, i) => {
        const color = line.startsWith('+') && !line.startsWith('+++')
          ? '#4ade80'
          : line.startsWith('-') && !line.startsWith('---')
          ? '#f87171'
          : line.startsWith('@@')
          ? '#60a5fa'
          : '#f9fafb';
        return (
          <span key={i} style={{ color, display: 'block' }}>
            {line}
          </span>
        );
      })}
    </pre>
  );
}

function SpanRow({ span }: { span: TraceSpan }) {
  const durationMs = span.endMs - span.startMs;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '4px 0',
      borderBottom: '1px solid #e5e7eb',
      fontSize: 12,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        backgroundColor: span.status === 'ok' ? '#10b981' : span.status === 'error' ? '#ef4444' : '#f59e0b',
        flexShrink: 0,
      }} />
      <span style={{ flex: 1, fontFamily: 'monospace' }}>{span.name}</span>
      <span style={{ color: '#6b7280', width: 60, textAlign: 'right' }}>{durationMs}ms</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface ExecutionTracePanelProps {
  trace: ExecutionTrace;
  onClose?: () => void;
}

/**
 * ExecutionTracePanel — read-only visualization of an AI control-plane invocation.
 *
 * DESIGN INVARIANT: This component is VISUALIZATION ONLY.
 * It never triggers re-execution, never calls APIs, never mutates state.
 * All data comes from the `trace` prop (server-fetched).
 */
export function ExecutionTracePanel({ trace, onClose }: ExecutionTracePanelProps) {
  const [activeTab, setActiveTab] = React.useState<'trace' | 'result' | 'diff'>('trace');

  const hasDiff = !!trace.diff;

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      overflow: 'hidden',
      fontFamily: 'system-ui, sans-serif',
      boxShadow: '0 1px 3px rgba(0,0,0,.1)',
    }}>
      {/* Header */}
      <div style={{
        background: '#f9fafb',
        borderBottom: '1px solid #e5e7eb',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              {trace.toolName}
            </span>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>v{trace.toolVersion}</span>
            <StatusPill ok={trace.deterministic} label={trace.deterministic ? 'deterministic' : 'non-det'} />
            {trace.fromCache && <StatusPill ok={true} label="cached" />}
          </div>
          <HashBadge hash={trace.hash} label="replay hash" />
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#6b7280' }}>
          <div>{trace.durationMs}ms</div>
          {trace.modelCost && (
            <div style={{ color: '#f59e0b', fontWeight: 600 }}>
              {trace.modelCost.costCents}¢
            </div>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}
            aria-label="Close trace panel"
          >
            ×
          </button>
        )}
      </div>

      {/* Model Cost (if present) */}
      {trace.modelCost && (
        <div style={{
          background: '#fffbeb',
          borderBottom: '1px solid #fde68a',
          padding: '6px 16px',
          display: 'flex',
          gap: 16,
          fontSize: 11,
          color: '#92400e',
        }}>
          <span>Model: <strong>{trace.modelCost.model}</strong></span>
          <span>In: {trace.modelCost.inputTokens.toLocaleString()} tokens</span>
          <span>Out: {trace.modelCost.outputTokens.toLocaleString()} tokens</span>
          <span>Cost: <strong>{trace.modelCost.costCents}¢</strong> (${(trace.modelCost.costCents / 100).toFixed(4)})</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #e5e7eb',
        background: '#f9fafb',
      }}>
        {(['trace', 'result', ...(hasDiff ? ['diff' as const] : [])] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? '#111827' : '#6b7280',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ padding: 16 }}>
        {activeTab === 'trace' && (
          <div>
            <div style={{ marginBottom: 8, fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>
              EXECUTION SPANS ({trace.spans.length})
            </div>
            {trace.spans.length === 0 ? (
              <div style={{ color: '#9ca3af', fontSize: 12 }}>No spans recorded.</div>
            ) : (
              trace.spans.map(s => <SpanRow key={s.spanId} span={s} />)
            )}
            <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
              <HashBadge hash={trace.requestId} label="trace id" />
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                Tenant: {trace.tenantId}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'result' && (
          <pre style={{
            fontFamily: 'monospace',
            fontSize: 11,
            background: '#111827',
            color: '#f9fafb',
            padding: 12,
            borderRadius: 6,
            overflow: 'auto',
            maxHeight: 400,
            margin: 0,
          }}>
            {JSON.stringify(trace.result, null, 2)}
          </pre>
        )}

        {activeTab === 'diff' && trace.diff && (
          <DiffViewer diff={trace.diff} />
        )}
      </div>
    </div>
  );
}

// ─── Re-export for convenience ────────────────────────────────────────────────

export type { ExecutionTrace as WebIDETrace };
