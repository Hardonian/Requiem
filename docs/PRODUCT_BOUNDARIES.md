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

**Autonomous worker is implemented.** An operator can start/stop background workers via `POST /api/worker` with `action=start|stop|status`. When running, the worker polls the durable queue, recovers stale leases, claims and processes jobs, and finalizes them. Without a running worker, durable plan jobs are processed only when an operator explicitly calls `action=process`.

## Organization membership

**What works today:**
- Create/update/delete organizations per tenant
- Assign roles (admin/operator/viewer) to actor IDs via `set_member_role`
- Role-enforced access: admin can CRUD orgs and manage members; operator can enqueue/process jobs; viewer can read
- Validate actor role against minimum threshold
- List organizations and memberships for current tenant
- Invite user by email with durable token and configurable expiry
- Accept invite with token validation, expiry check, and role assignment
- Revoke pending invite (admin only)
- Remove individual member from organization (with self-removal prevention)
- Change member role with admin enforcement
- List members with seat count

**What does NOT exist:**
- Billing/payment integration for seat accounting
- Self-service role change (requires admin)
- Org-switching UI in console

## Deployment topologies

**Supported:**
- Local single-runtime (filesystem-backed, dev only)
- Shared request-bound ReadyLayer + Supabase
- Shared request-bound ReadyLayer + Supabase + external runtime API
- Durable plan-job queue with autonomous worker or operator-driven processing

**Not supported:**
- Serverless/edge claiming durable async continuation
- Enterprise SaaS with billing/seat management

## Readiness semantics

`/api/readiness` reports:
- `durable_queue_available: true` — jobs can be enqueued and will survive process loss
- `autonomous_worker_active: true|false` — dynamically reflects whether a background worker is running
- `supported_durability_classes` — which execution classes are operational
- `membership_lifecycle.supported` — lists all implemented member management capabilities
- `membership_lifecycle.not_implemented` — explicitly lists what is still missing (billing, self-service role change, org-switching UI)

## What is intentionally out of scope

- Billing/seat/usage metering
- Multi-workspace or org-switching UI
- Cross-tenant data sharing or federation
- Horizontal auto-scaling or shard rebalancing
- Real-time WebSocket job status streaming
