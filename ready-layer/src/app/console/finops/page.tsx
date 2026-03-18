"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BudgetErrorDisplay,
  EmptyState,
  ErrorDisplay,
  LoadingState,
  PageHeader,
} from "@/components/ui";

interface BudgetView {
  key: string;
  name: string;
  limit: number;
  used: number;
  remaining: number;
  unit: string;
}

const BUDGET_METADATA: Record<string, { name: string; unit: string }> = {
  exec: { name: "Executions", unit: "calls" },
  cas_put: { name: "CAS Writes", unit: "writes" },
  cas_get: { name: "CAS Reads", unit: "reads" },
  policy_eval: { name: "Policy Evaluations", unit: "evals" },
  plan_step: { name: "Plan Steps", unit: "steps" },
};

export default function ConsoleFinOpsPage() {
  const [budgets, setBudgets] = useState<BudgetView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{
    code: string;
    message: string;
    traceId?: string;
  } | null>(null);
  const [resetting, setResetting] = useState(false);

  const fetchBudgets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/budgets");
      const result = await response.json();

      if (result.data?.ok && result.data.budget) {
        const budgetEntries = Object.entries(result.data.budget.budgets ?? {})
          .map(([key, value]) => {
            if (!value || !BUDGET_METADATA[key]) return null;
            const unitValue = value as {
              limit?: number;
              used?: number;
              remaining?: number;
            };
            return {
              key,
              name: BUDGET_METADATA[key].name,
              limit: Number(unitValue.limit ?? 0),
              used: Number(unitValue.used ?? 0),
              remaining: Number(unitValue.remaining ?? 0),
              unit: BUDGET_METADATA[key].unit,
            } satisfies BudgetView;
          })
          .filter((entry): entry is BudgetView => entry !== null);

        setBudgets(budgetEntries);
      } else {
        setBudgets([]);
      }
    } catch (err) {
      setError({
        code: "E_NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network error occurred",
      });
      setBudgets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const handleResetWindow = useCallback(async () => {
    setResetting(true);
    try {
      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ action: "reset-window" }),
      });
      const result = await response.json();

      if (result.data?.ok) {
        await fetchBudgets();
      } else {
        setError({
          code: result.error?.code ?? "E_RESET_FAILED",
          message: result.error?.message ?? "Failed to reset budget window",
        });
      }
    } catch (err) {
      setError({
        code: "E_NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network error occurred",
      });
    } finally {
      setResetting(false);
    }
  }, [fetchBudgets]);

  const getUsagePercent = (used: number, limit: number) => {
    if (!limit) return 0;
    return Math.min(100, (used / limit) * 100);
  };

  const getUsageBarClass = (percent: number, used: number, limit: number) => {
    if (used > limit || percent >= 90) return "bg-destructive";
    if (percent >= 70) return "bg-warning";
    return "bg-success";
  };

  const exceededBudgets = budgets.filter((b) => b.used > b.limit);

  return (
    <div className="mx-auto max-w-7xl p-6">
      <PageHeader
        title="FinOps"
        description="Budget tracking and financial operations. Values come from the tenant-local control-plane store and update when related actions execute."
        action={
          <button
            onClick={handleResetWindow}
            disabled={resetting}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
          >
            {resetting ? "Resetting..." : "Reset Window"}
          </button>
        }
      />

      {exceededBudgets.map((budget) => (
        <div key={budget.key} className="mb-4">
          <BudgetErrorDisplay
            limitName={budget.name}
            currentUsage={budget.used}
            limit={budget.limit}
            unit={budget.unit}
          />
        </div>
      ))}

      {error && !exceededBudgets.length && (
        <div className="mb-6">
          <ErrorDisplay
            code={error.code}
            message={error.message}
            traceId={error.traceId}
            onRetry={fetchBudgets}
          />
        </div>
      )}

      {loading ? (
        <LoadingState message="Loading budgets..." />
      ) : budgets.length === 0 ? (
        <EmptyState
          title="No budget state available"
          description="Budgets initialize automatically for each tenant. If this state stays empty, verify the control-plane store directory is writable."
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => {
            const percent = getUsagePercent(budget.used, budget.limit);
            const isExceeded = budget.used > budget.limit;

            return (
              <div
                key={budget.key}
                className={`rounded-xl border bg-surface p-6 shadow-sm ${
                  isExceeded ? "border-destructive/50" : "border-border"
                }`}
              >
                <div className="mb-4 flex items-start justify-between">
                  <h3 className="text-base font-semibold text-foreground">
                    {budget.name}
                  </h3>
                  {isExceeded && (
                    <span className="inline-flex items-center rounded border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      Exceeded
                    </span>
                  )}
                </div>

                <div className="mb-4">
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted">
                      {budget.used.toLocaleString()} /{" "}
                      {budget.limit.toLocaleString()} {budget.unit}
                    </span>
                    <span
                      className={`font-medium ${isExceeded ? "text-destructive" : "text-foreground"}`}
                    >
                      {percent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full border border-border bg-surface-elevated">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getUsageBarClass(percent, budget.used, budget.limit)}`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                </div>

                <div className="flex justify-between border-t border-border pt-4 text-sm">
                  <span className="text-muted">Remaining</span>
                  <span
                    className={`font-medium ${budget.remaining < 0 ? "text-destructive" : "text-success"}`}
                  >
                    {budget.remaining.toLocaleString()} {budget.unit}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
