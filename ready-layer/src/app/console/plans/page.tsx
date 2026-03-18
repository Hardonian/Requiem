"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  ErrorDisplay,
  LoadingState,
  PageHeader,
  RouteMaturityNote,
  VerificationBadge,
} from "@/components/ui";
import { getRouteMaturity, maturityNoteTone } from "@/lib/route-maturity";

interface PlanCard {
  id: string;
  hash: string;
  createdAt: string;
  stepCount: number;
  lastRun?: string;
}

export default function ConsolePlansPage() {
  const routeMaturity = getRouteMaturity("/console/plans");
  const [plans, setPlans] = useState<PlanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{
    code: string;
    message: string;
    traceId?: string;
  } | null>(null);
  const [activePlanHash, setActivePlanHash] = useState<string | null>(null);
  const [runningPlanHash, setRunningPlanHash] = useState<string | null>(null);
  const [runFeedback, setRunFeedback] = useState<{
    status: "verified" | "failed";
    message: string;
  } | null>(null);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/plans");
      const envelope = await response.json();
      const inner = envelope.data;

      if (inner?.ok) {
        const items = Array.isArray(inner.plans) ? inner.plans : [];
        setPlans(
          items.map(
            (plan: {
              plan_id: string;
              plan_hash: string;
              steps: unknown[];
              created_at_unix_ms?: number;
            }) => ({
              id: plan.plan_id,
              hash: plan.plan_hash,
              createdAt: plan.created_at_unix_ms
                ? new Date(plan.created_at_unix_ms).toISOString()
                : "",
              stepCount: Array.isArray(plan.steps) ? plan.steps.length : 0,
            }),
          ),
        );
      } else {
        setError({
          code: envelope.error?.code ?? "E_FETCH_FAILED",
          message: envelope.error?.message ?? "Failed to fetch plans",
        });
        setPlans([]);
      }

      const nextPlans = Array.isArray(envelope.data.plans)
        ? envelope.data.plans.map((plan) => ({
            id: plan.plan_hash ?? plan.plan_id ?? 'unknown-plan',
            name: plan.plan_id ?? plan.plan_hash ?? 'Unnamed plan',
            status: 'registered',
            createdAt: '',
            stepCount: Array.isArray(plan.steps) ? plan.steps.length : 0,
            description: plan.plan_version ? `Plan version ${plan.plan_version}` : undefined,
          }))
        : [];
      setPlans(nextPlans);
    } catch (err) {
      setError({
        code: "E_NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network error occurred",
      });
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.hash === activePlanHash) ?? null,
    [activePlanHash, plans],
  );

  const fetchPlanRuns = useCallback(async (planHash: string) => {
    try {
      const response = await fetch(
        `/api/plans?plan-hash=${encodeURIComponent(planHash)}`,
      );
      const envelope = await response.json();
      const runs = Array.isArray(envelope.data?.runs) ? envelope.data.runs : [];
      setPlans((prev) =>
        prev.map((plan) =>
          plan.hash === planHash
            ? {
                ...plan,
                lastRun: runs[0]?.completed_at_unix_ms
                  ? new Date(runs[0].completed_at_unix_ms).toISOString()
                  : plan.lastRun,
              }
            : plan,
        ),
      );
    } catch {
      // best-effort refresh only; route-level fetch handles hard failures elsewhere
    }
  }, []);

  const handleRunPlan = useCallback(
    async (planHash: string) => {
      setRunningPlanHash(planHash);
      setRunFeedback(null);
      try {
        const response = await fetch("/api/plans", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({ action: "run", plan_hash: planHash }),
        });
        const envelope = await response.json();
        if (envelope.data?.ok && envelope.data.result?.run_id) {
          setRunFeedback({
            status: "verified",
            message: `Run ${envelope.data.result.run_id} completed and is now recorded in tenant history.`,
          });
          await fetchPlanRuns(planHash);
        } else {
          setRunFeedback({
            status: "failed",
            message: envelope.error?.message ?? "Plan execution failed.",
          });
        }
      } catch (err) {
        setRunFeedback({
          status: "failed",
          message:
            err instanceof Error ? err.message : "Plan execution failed.",
        });
      } finally {
        setRunningPlanHash(null);
      }
    },
    [fetchPlanRuns],
  );

  return (
    <div className="mx-auto max-w-7xl p-6">
      <PageHeader
        title="Plans"
        description="Plan definitions and execution workflows. This route reads and runs tenant-scoped plans stored by the local control-plane runtime."
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
            onRetry={fetchPlans}
          />
        </div>
      )}

      {runFeedback && (
        <div className="mb-6">
          <VerificationBadge
            status={runFeedback.status === "verified" ? "verified" : "failed"}
            message={
              runFeedback.status === "verified" ? "Run recorded" : "Run failed"
            }
            details={runFeedback.message}
          />
        </div>
      )}

      {loading ? (
        <LoadingState message="Loading plans..." />
      ) : plans.length === 0 ? (
        <EmptyState
          title="No plans found"
          description="Create a plan through the API or CLI before attempting runs. Empty state is truthful: no plan definitions exist for this tenant yet."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.hash}
                className="rounded-xl border border-border bg-surface p-5 shadow-sm"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="truncate text-lg font-semibold text-foreground">
                      {plan.id}
                    </h3>
                    <p className="mt-1 text-xs font-mono text-muted">
                      {plan.hash.slice(0, 16)}…
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-medium text-accent hover:underline"
                    onClick={() => {
                      setActivePlanHash(plan.hash);
                      void fetchPlanRuns(plan.hash);
                    }}
                  >
                    Inspect
                  </button>
                </div>

                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Steps</dt>
                    <dd className="text-foreground">{plan.stepCount}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Created</dt>
                    <dd className="text-foreground">
                      {plan.createdAt ? plan.createdAt.substring(0, 10) : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Last run</dt>
                    <dd className="text-foreground">
                      {plan.lastRun
                        ? plan.lastRun.substring(0, 19).replace("T", " ")
                        : "Never"}
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  onClick={() => handleRunPlan(plan.hash)}
                  disabled={runningPlanHash === plan.hash}
                  className="mt-5 w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {runningPlanHash === plan.hash ? "Running..." : "Run plan"}
                </button>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">
              Plan detail
            </h2>
            {selectedPlan ? (
              <div className="mt-4 space-y-3 text-sm">
                <p className="text-muted">
                  Selected plan:{" "}
                  <span className="font-mono text-foreground">
                    {selectedPlan.id}
                  </span>
                </p>
                <p className="text-muted">
                  Plan hash:{" "}
                  <span className="font-mono text-foreground break-all">
                    {selectedPlan.hash}
                  </span>
                </p>
                <p className="text-muted">
                  Last observed run:{" "}
                  <span className="text-foreground">
                    {selectedPlan.lastRun
                      ? selectedPlan.lastRun.replace("T", " ").substring(0, 19)
                      : "None yet"}
                  </span>
                </p>
                <p className="text-muted">
                  Use “Run plan” to create a persisted run and surface it
                  immediately on this route and in the runs console.
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">
                Select a plan card to inspect its persisted hash and latest run
                state.
              </p>
            )}
          </div>
        </div>
      )}

      {!loading && plans.length > 0 && (
        <div className="mt-6 text-sm text-muted">
          Total: {plans.length} plan{plans.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
