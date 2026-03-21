import type { WorkerHandle } from '@/lib/control-plane-store';

// Process-scoped worker registry — shared between worker API route and readiness checks
const activeWorkers = new Map<string, WorkerHandle>();

export function workerKey(tenantId: string, orgId: string | undefined): string {
  return `${tenantId}:${orgId ?? '*'}`;
}

export function getActiveWorkers(): Map<string, WorkerHandle> {
  return activeWorkers;
}

export function isAnyWorkerActive(): boolean {
  return activeWorkers.size > 0;
}

export function getWorkerCount(): number {
  return activeWorkers.size;
}
