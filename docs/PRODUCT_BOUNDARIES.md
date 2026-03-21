# Product Boundaries — Hard Truth Declaration

This document states exactly what the product supports today and what it does not. It is intentionally short, blunt, and impossible to misread.

## Execution durability

| Execution path | Durability class | Survives process loss? | Duplicate-safe? | Operator-visible recovery? |
| --- | --- | --- | --- | --- |
| Plan job queue (enqueue/process/recover) | **durable-queued** | Yes | Yes (lease-based) | Yes |
| Plan run via `/api/plans` (action=run) | request-bound | No | No | No |
| Org/member CRUD | request-bound | No (atomic within request) | Yes (idempotency-keyed) | No |
| Engine proxy via `/api/engine/*` | externally-delegated | Depends on external runtime | No | No |
| Health/readiness/status probes | informational | N/A | N/A | N/A |

**There is no autonomous background worker.** Durable plan jobs are processed only when an operator or external scheduler explicitly calls `action=process`. A deployment that enqueues jobs without any caller for `action=process` will accumulate pending jobs indefinitely.

## Organization membership

**What works today:**
- Create/update/delete organizations per tenant
- Assign roles (admin/operator/viewer) to actor IDs via `set_member_role`
- Role-enforced access: admin can CRUD orgs and manage members; operator can enqueue/process jobs; viewer can read
- Validate actor role against minimum threshold
- List organizations and memberships for current tenant

**What does NOT exist:**
- Email-based invite with durable token
- Invite acceptance flow with expiry/invalid/already-used handling
- Invite revocation
- Member deactivation/removal independent of org deletion
- Seat accounting or billing integration
- Self-service role change
- Org-switching UI

## Deployment topologies

**Supported:**
- Local single-runtime (filesystem-backed, dev only)
- Shared request-bound ReadyLayer + Supabase
- Shared request-bound ReadyLayer + Supabase + external runtime API
- Durable plan-job queue with operator-driven processing

**Not supported:**
- Autonomous background worker polling the queue
- Serverless/edge claiming durable async continuation
- Enterprise SaaS with invite/seat/billing management

## Readiness semantics

`/api/readiness` reports:
- `durable_queue_available: true` — jobs can be enqueued and will survive process loss
- `autonomous_worker_active: false` — no background polling; requires explicit processing calls
- `supported_durability_classes` — which execution classes are operational
- `membership_lifecycle.not_implemented` — explicitly lists what member management is missing

A deployment without an active worker/scheduler must not imply that queued jobs are being automatically processed.

## What is intentionally out of scope

- Background worker daemon or scheduler built into ReadyLayer
- Email/notification integration for invites or alerts
- Billing/seat/usage metering
- Multi-workspace or org-switching UI
- Cross-tenant data sharing or federation
- Horizontal auto-scaling or shard rebalancing
- Real-time WebSocket job status streaming
