"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EmptyState,
  ErrorDisplay,
  HashDisplay,
  LoadingState,
  PageHeader,
} from "@/components/ui";

interface CapabilityItem {
  actor: string;
  seq: number;
  data_hash: string;
  event_type: string;
}

export default function ConsoleCapabilitiesPage() {
  const [capabilities, setCapabilities] = useState<CapabilityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{
    code: string;
    message: string;
    traceId?: string;
  } | null>(null);
  const [revokingSeq, setRevokingSeq] = useState<number | null>(null);

  const fetchCapabilities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/caps?limit=100");
      const envelope = await response.json();
      const inner = envelope.data;
      if (inner?.ok) {
        setCapabilities(Array.isArray(inner.data) ? inner.data : []);
      } else {
        setError({
          code: envelope.error?.code ?? "E_FETCH_FAILED",
          message: envelope.error?.message ?? "Failed to fetch capabilities",
        });
      }
    } catch (err) {
      setError({
        code: "E_NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network error occurred",
      });
      setCapabilities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCapabilities();
  }, [fetchCapabilities]);

  const handleRevoke = useCallback(async (item: CapabilityItem) => {
    if (
      !window.confirm(
        `Revoke capability for subject ${item.actor} (seq ${item.seq})?`,
      )
    )
      return;

    setRevokingSeq(item.seq);
    try {
      const response = await fetch("/api/caps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ action: "revoke", fingerprint: item.data_hash }),
      });
      const envelope = await response.json();
      const inner = envelope.data;

      if (inner?.ok) {
        setCapabilities((prev) => prev.filter((cap) => cap.seq !== item.seq));
      } else {
        setError({
          code: envelope.error?.code ?? "E_REVOKE_FAILED",
          message: envelope.error?.message ?? "Failed to revoke capability",
        });
      }
    } catch (err) {
      setError({
        code: "E_NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network error occurred",
      });
    } finally {
      setRevokingSeq(null);
    }
  }, []);

  return (
    <div className="mx-auto max-w-7xl p-6">
      <PageHeader
        title="Capabilities"
        description="Capability tokens for fine-grained authorization. Entries are tenant-scoped and update when mint/revoke actions are persisted."
      />

      {error && (
        <div className="mb-6">
          <ErrorDisplay
            code={error.code}
            message={error.message}
            traceId={error.traceId}
            onRetry={fetchCapabilities}
          />
        </div>
      )}

      {loading ? (
        <LoadingState message="Loading capabilities..." />
      ) : capabilities.length === 0 ? (
        <EmptyState
          title="No capabilities found"
          description="Mint capabilities through the API or CLI to grant tenant-scoped permissions; revoked entries disappear from this active view."
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <table className="stitch-table">
              <thead>
                <tr>
                  <th>Seq</th>
                  <th>Subject</th>
                  <th>Last Event</th>
                  <th>Fingerprint</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {capabilities.map((cap) => (
                  <tr key={cap.seq}>
                    <td className="font-mono text-sm text-muted">#{cap.seq}</td>
                    <td className="font-mono text-sm text-foreground">
                      {cap.actor || "—"}
                    </td>
                    <td>
                      <span className="inline-flex items-center rounded border border-accent/20 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                        {cap.event_type || "—"}
                      </span>
                    </td>
                    <td>
                      <HashDisplay hash={cap.data_hash} length={16} />
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => handleRevoke(cap)}
                        disabled={revokingSeq === cap.seq}
                        className="text-sm font-medium text-destructive transition-colors hover:text-destructive/80 disabled:opacity-50"
                        type="button"
                      >
                        {revokingSeq === cap.seq ? "Revoking..." : "Revoke"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-sm text-muted">
            Total: {capabilities.length} capability token
            {capabilities.length !== 1 ? "s" : ""}
          </p>
        </>
      )}
    </div>
  );
}
