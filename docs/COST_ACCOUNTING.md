# Cost Accounting

> Token and cost tracking framework - to be populated during Phase 5.

## Overview

Cost accounting tracks resource consumption across the Requiem system:
- Token usage (LLM API calls)
- Compute resources
- API calls
- Storage operations

## What is Measured

### Token Usage

| Metric | Description | Unit |
|--------|-------------|------|
| prompt_tokens | Input tokens | tokens |
| completion_tokens | Output tokens | tokens |
| total_tokens | Total tokens | tokens |
| cached_tokens | Cached tokens | tokens |

### Cost Dimensions

| Dimension | Unit | Rate Source |
|-----------|------|-------------|
| llm_compute | tokens | Model pricing table |
| api_calls | requests | Per-endpoint pricing |
| storage | GB-days | Storage tier |
| compute_time | seconds | Instance pricing |

## Data Model

### Cost Record

```typescript
interface CostRecord {
  id: string;
  tenantId: string;
  
  // Timing
  timestamp: Date;
  period: string; // YYYY-MM
  
  // Resource
  resourceType: 'llm' | 'api' | 'storage' | 'compute';
  resourceId: string;
  
  // Usage
  usage: number;
  unit: string;
  
  // Cost
  cost: number;
  currency: string;
  
  // Attribution
  userId?: string;
  requestId?: string;
  correlationId?: string;
}
```

### Aggregation

```typescript
interface CostAggregation {
  tenantId: string;
  period: string;
  
  byResource: {
    [resourceType: string]: {
      usage: number;
      cost: number;
    };
  };
  
  byUser: {
    [userId: string]: {
      usage: number;
      cost: number;
    };
  };
  
  total: {
    usage: number;
    cost: number;
  };
}
```

## Storage

### Primary Storage

- **Database**: `costs` table in `ready-layer`
- **Retention**: 90 days hot, 1 year cold

### Archive Storage

- **Location**: `artifacts/costs/`
- **Format**: Parquet files
- **Retention**: 7 years

### Query Interface

```typescript
// Get costs for period
const costs = await getCosts({
  tenantId: 'tenant_123',
  period: '2026-02',
  resourceType: 'llm',
});

// Get aggregation
const summary = await getCostSummary({
  tenantId: 'tenant_123',
  period: '2026-02',
  groupBy: 'user',
});
```

## Tracking Points

### LLM Calls

```
┌─────────────────────────────────────────────┐
│  Request → Policy Check → LLM Call         │
│                        ↓                     │
│                 Token Count                 │
│                        ↓                     │
│              Cost Record                   │
│                        ↓                     │
│                 Response                    │
└─────────────────────────────────────────────┘
```

### API Calls

```
┌─────────────────────────────────────────────┐
│  Request → Rate Limit → Handler             │
│                        ↓                     │
│               API Call Count                │
│                        ↓                     │
│             Cost Record                     │
│                        ↓                     │
│               Response                      │
└─────────────────────────────────────────────┘
```

## Budget Alerts

### Thresholds

| Level | Threshold | Action |
|-------|------------|--------|
| warning | 75% | Notify |
| critical | 90% | Notify + Log |
| exceeded | 100% | Block + Notify |

### Configuration

```typescript
interface BudgetConfig {
  tenantId: string;
  period: 'daily' | 'monthly';
  limit: number;
  currency: string;
  alerts: AlertConfig[];
}
```

## Reporting

### API Endpoint

```
GET /api/costs/summary
GET /api/costs/detail
GET /api/costs/trends
```

### Dashboard

Available in `ready-layer` at `/app/costs`

---

**Status**: Initial scaffold - to be populated during implementation phases.
