"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EmptyState,
  ErrorDisplay,
  HashDisplay,
  LoadingState,
  PageHeader,
  RouteMaturityNote,
  VerificationBadge,
} from "@/components/ui";
import { normalizeEnvelope } from "@/lib/api-truth";
import { getRouteMaturity, maturityNoteTone } from "@/lib/route-maturity";

interface SnapshotRow {
  hash: string;
  logicalTime: number;
  eventLogHead: string;
  createdAt: string;
  activeCaps: number;
  revokedCaps: number;
}

interface SnapshotRecord {
  snapshot_hash?: string;
  logical_time?: number;
  event_log_head?: string;
  timestamp_unix_ms?: number;
  active_caps?: string[];
  revoked_caps?: string[];
}

interface SnapshotListPayload {
  data?: SnapshotRecord[];
}

interface SnapshotMutationPayload {
  message?: string;
}

export default function ConsoleSnapshotsPage() {
  const routeMaturity = getRouteMaturity("/console/snapshots");
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{
    code: string;
    message: string;
    traceId?: string;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const fetchSnapshots = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/snapshots");
      const envelope = normalizeEnvelope<SnapshotListPayload>(await response.json());

      if (!envelope.ok) {
        setError({
          code: envelope.error?.code ?? "E_FETCH_FAILED",
          message: envelope.error?.message ?? "Failed to fetch snapshots",
          traceId: envelope.traceId,
        });
        setSnapshots([]);
        return;
      }

      const rows = Array.isArray(envelope.data?.data) ? envelope.data.data : [];
      setSnapshots(
        rows.map((snapshot) => ({
          hash: snapshot.snapshot_hash ?? "unknown-snapshot",
          logicalTime: snapshot.logical_time ?? 0,
          eventLogHead: snapshot.event_log_head ?? "",
          createdAt: snapshot.timestamp_unix_ms
            ? new Date(snapshot.timestamp_unix_ms).toISOString()
            : "",
          activeCaps: Array.isArray(snapshot.active_caps)
            ? snapshot.active_caps.length
            : 0,
          revokedCaps: Array.isArray(snapshot.revoked_caps)
            ? snapshot.revoked_caps.length
            : 0,
        })),
      );
    } catch (err) {
      setError({
        code: "E_NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network error occurred",
      });
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSnapshots();
  }, [fetchSnapshots]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    setRestoreResult(null);
    try {
      const response = await fetch("/api/snapshots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ action: "create" }),
      });
      const envelope = normalizeEnvelope<SnapshotMutationPayload>(await response.json());
      if (envelope.ok) {
        setRestoreResult({
          success: true,
          message: envelope.data?.message ?? "Snapshot captured and persisted for this tenant.",
        });
        await fetchSnapshots();
      } else {
        setRestoreResult({
          success: false,
          message: envelope.error?.message ?? "Failed to create snapshot.",
        });
      }
    } catch (err) {
      setRestoreResult({
        success: false,
        message:
          err instanceof Error ? err.message : "Snapshot creation failed.",
      });
    } finally {
      setCreating(false);
    }
  }, [fetchSnapshots]);

  const handleRestore = useCallback(
    async (hash: string) => {
      if (
        !window.confirm(
          `Restore snapshot ${hash.slice(0, 12)}…?

This replaces tenant-scoped budget and capability state with the snapshot contents during the current request.`,
        )
      ) {
        return;
      }

      setRestoringId(hash);
      setRestoreResult(null);
      try {
        const response = await fetch("/api/snapshots", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({ action: "restore", snapshot_hash: hash, force: true }),
        });
        const envelope = normalizeEnvelope<SnapshotMutationPayload>(await response.json());
        setRestoreResult({
          success: envelope.ok,
          message:
            envelope.data?.message ??
            envelope.error?.message ??
            "Restore request finished with an unknown response.",
        });
        if (envelope.ok) {
          await fetchSnapshots();
        }
      } catch (err) {
        setRestoreResult({
          success: false,
          message:
            err instanceof Error ? err.message : "Restore request failed.",
        });
      } finally {
        setRestoringId(null);
      }
    },
    [fetchSnapshots],
  );

  return (
    <div className="mx-auto max-w-7xl p-6">
      <PageHeader
        title="Snapshots"
        description="Tenant-scoped snapshots for rollback and audit. Snapshot creation and restore are synchronous request-bound operations; they do not continue after process loss."
        action={
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Capturing..." : "Create snapshot"}
          </button>
        }
      />

      <RouteMaturityNote
        maturity={maturityNoteTone(routeMaturity.maturity)}
        title="Maturity: runtime-backed route"
      >
        {routeMaturity.degradedBehavior}
      </RouteMaturityNote>

      {error && (
        <div className="mb-6">
          <ErrorDisplay
            code={error.code}
            message={error.message}
            traceId={error.traceId}
            onRetry={() => void fetchSnapshots()}
          />
        </div>
      )}

      {restoreResult && (
        <div className="mb-6">
          <VerificationBadge
            status={restoreResult.success ? "verified" : "failed"}
            message={
              restoreResult.success
                ? "Snapshot operation complete"
                : "Snapshot operation failed"
            }
            details={restoreResult.message}
          />
        </div>
      )}

      {loading ? (
        <LoadingState message="Loading snapshots..." />
      ) : snapshots.length === 0 ? (
        <EmptyState
          title="No snapshots found"
          description="No snapshots exist for this tenant yet. Create one to capture current budget, capability, and policy state."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-elevated">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                  Snapshot
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                  Event log head
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                  Logical time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                  Capabilities
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {snapshots.map((snapshot) => (
                <tr key={snapshot.hash} className="hover:bg-surface-elevated">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <HashDisplay hash={snapshot.hash} length={18} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <HashDisplay hash={snapshot.eventLogHead} length={18} />
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {snapshot.logicalTime.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {snapshot.activeCaps} active / {snapshot.revokedCaps}{" "}
                    revoked
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-muted">
                    {snapshot.createdAt.replace("T", " ").substring(0, 19)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    <button
                      onClick={() => void handleRestore(snapshot.hash)}
                      disabled={restoringId === snapshot.hash}
                      className="text-accent transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                      type="button"
                    >
                      {restoringId === snapshot.hash
                        ? "Restoring..."
                        : "Restore"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && snapshots.length > 0 && (
        <div className="mt-4 text-sm text-muted">
          Total: {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
