# Console Reference

> ReadyLayer web dashboard route guide

---

## Dashboard Routes (/app/\*)

### /app/executions

**Purpose:** Execution history with determinism proofs

**Features:**

- View recent tool executions
- Verify determinism status
- Check replay verification
- Export execution data

**Empty State:** Shows CLI command to trigger first execution

---

### /app/replay

**Purpose:** Replay verification dashboard

**Features:**

- View replay verified rate
- Monitor divergence count
- Verify immutable records
- Trigger replay checks

**CLI Equivalent:** `reach replay run <id>`

---

### /app/cas

**Purpose:** Content-Addressable Storage metrics

**Features:**

- Hit rate monitoring
- Deduplication ratio
- Write latency tracking
- Integrity check link

---

### /app/policy

**Purpose:** Policy enforcement dashboard

**Features:**

- Active protection layers
- Enforcement mode status
- Violation tracking
- Enterprise controls

**Protection Layers:**

- Budget Enforcement
- RBAC Capabilities
- Content Guardrails
- Rate Limiting
- SSRF Protection
- Side-Effect Restriction

---

### /app/audit

**Purpose:** Immutable audit ledger

**Features:**

- Append-only audit log
- Merkle chain integrity
- Compliance export (JSON/CSV)
- Tenant-scoped view

**Export Endpoints:**

- `/api/audit/logs?format=json&limit=1000`
- `/api/audit/logs?format=csv&limit=1000`

---

### /app/metrics

**Purpose:** Observability metrics

**Metrics Shown:**

- Determinism Rate (%)
- Replay Verified (%)
- Divergence Count
- p50/p95/p99 Latency
- CAS Hit Rate
- Replay Storage
- Policy Events

---

### /app/diagnostics

**Purpose:** Engine health and diagnostics

**Features:**

- System health checks
- Build metadata
- Engine reachability
- CAS backend status

**Build Metadata:**

- Engine version
- ABI version
- Hash algorithm
- CAS format
- Build timestamp

---

### /app/tenants

**Purpose:** Tenant isolation management

**Features:**

- Active tenant list
- CAS isolation status
- Execution counts
- Quota usage

---

## Marketing Routes

### / (Landing)

Category definition and value proposition.

**Sections:**

- Hero with CTA
- Control plane definition
- Four layers overview
- Governance-first architecture

---

### /pricing

Pricing tiers and feature comparison.

**Tiers:**

- **OSS** - Free forever
- **Pro** - $99/month
- **Enterprise** - Custom

**Usage Primitives:**

- Execution Credits
- Replay Storage
- Policy Events

---

### /security

Security features and certifications.

---

### /transparency

Transparency report and compliance info.

---

### /library

Template library for common patterns.

---

### /templates

Quick-start templates.

---

### /enterprise

Enterprise features and contact.

---

## Support Routes

### /support

Support hub with documentation links.

### /support/contact

Contact form for sales/support.

### /support/status

System status page.

---

## Dynamic Routes

### /runs/[runId]

Individual run details page.

**Displays:**

- Execution fingerprint
- Input/output
- Policy results
- Replay status

### /proof/diff/[token]

Shareable diff proof page.

---

## Navigation Structure

```
Sidebar (App Layout)
├── Execution
│   ├── Executions      → /app/executions
│   ├── Replay          → /app/replay
│   └── CAS Management  → /app/cas
├── Governance
│   ├── Policy Engine   → /app/policy
│   ├── Audit Ledger    → /app/audit
│   └── Artifact Signing → /app/signatures (Pro)
└── Operations
    ├── Observability   → /app/metrics
    ├── Doctor / Health → /app/diagnostics
    ├── Tenant Isolation → /app/tenants
    └── Foundational Models → /app/providers (Pro)
```

---

## State Handling

All dashboard routes implement:

| State   | Implementation                          |
| ------- | --------------------------------------- |
| Loading | Suspense + Skeleton UI                  |
| Error   | Error boundary with recovery            |
| Empty   | Illustrated empty states with CLI hints |

---

## Configuration

The dashboard requires:

```bash
# .env.local
REQUIEM_API_URL=http://localhost:8080
NEXT_PUBLIC_REQUIEM_API_URL=http://localhost:8080
```

Without configuration, shows standby mode with setup instructions.

---

_See also: [CLI Reference](./cli.md), [Architecture](../ARCHITECTURE.md)_
