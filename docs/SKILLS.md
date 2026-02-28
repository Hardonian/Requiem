# Skills System

> Agentic skills framework for Requiem - to be populated during Phase 4.

## Overview

The skills system provides a structured way to define, register, and execute agentic capabilities. Skills are composable units of work that can be combined to create complex workflows.

## Skill Definition

```typescript
interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  
  // Execution
  handler: SkillHandler;
  
  // Capabilities
  capabilities: Capability[];
  
  // Constraints
  timeout?: number;
  retryPolicy?: RetryPolicy;
  
  // Metadata
  tags: string[];
  author?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## Skill Types

### Action Skills

Execute specific operations:
- `decide_evaluate` - Evaluate a decision
- `junctions_scan` - Scan for junctions
- `cluster_status` - Get cluster status

### Analysis Skills

Process and analyze data:
- `diagnostics_run` - Run diagnostics
- `drift_detect` - Detect configuration drift
- `metrics_aggregate` - Aggregate metrics

### Orchestration Skills

Coordinate multiple operations:
- `workflow_execute` - Execute a workflow
- `parallel_run` - Run operations in parallel

## Skill Registry

*(To be implemented in Phase 4)*

### Registration

Skills are registered at startup:

```typescript
const registry = new SkillRegistry();
registry.register(skill);
```

### Discovery

```typescript
// Find skills by capability
const analyzers = registry.findByCapability('analyze');

// Find skills by tag
const security = registry.findByTag('security');
```

## Skill Runner

*(To be implemented in Phase 4)*

### Execution Model

1. Validate input against schema
2. Check permissions (policy gating)
3. Allocate resources
4. Execute skill handler
5. Record metrics
6. Handle errors/retry

### Context

Skills receive a standardized context:

```typescript
interface SkillContext {
  tenantId: string;
  userId: string;
  requestId: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}
```

## Capabilities

| Capability | Description | Required Tools |
|-----------|-------------|----------------|
| `read` | Read data | `SELECT`, `GET` |
| `write` | Write data | `INSERT`, `UPDATE`, `DELETE` |
| `analyze` | Analyze data | `COMPUTE`, `AGGREGATE` |
| `orchestrate` | Coordinate | `EXECUTE`, `PARALLEL` |

## Built-in Skills

*(To be populated during implementation)*

---

**Status**: Initial scaffold - to be populated during implementation phases.
