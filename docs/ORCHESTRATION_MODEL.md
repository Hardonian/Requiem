> **Status: historical / non-canonical for first-customer deployment.** Current deployment truth is documented in [`README.md`](../README.md), [`DEPLOYMENT.md`](./DEPLOYMENT.md), and [`OPERATOR_RUNBOOK.md`](./OPERATOR_RUNBOOK.md). Treat this document as background material unless and until the code/tests re-establish the claims below.

# Orchestration Model (Minimal, Deterministic)

## What Exists Today

Requiem already has a lightweight orchestration substrate in CLI libraries:

- deterministic workflow graph execution (`runWorkflow`)
- queue-based task staging (`enqueueWorkflow`)
- worker drain loop (`workerStart`)
- cluster introspection (`clusterStatus`, `workerStatus`)
- debug/replay artifact inspection (`debugExecution`, `replayWorkflow`)

## Model

```text
CLI/API trigger
  -> enqueue workflow task (optional)
  -> worker claims pending task
  -> run deterministic workflow graph
  -> emit proofpack + replay log + CAS object digest
  -> expose status via cluster/workers APIs or CLI
```

## Orchestration Contracts

1. **Task contract:** `{ id, workflow, input, status, worker_id? }`
2. **Result contract:** `{ task_id, run_id, state_hash }`
3. **Worker contract:** `{ processed, worker_id }`
4. **Cluster contract:** `{ queued, completed, workers, deterministic_replay_ready }`

## Safety Constraints

- Worker processing must only execute declared workflow files.
- Task inputs must be treated as untrusted; schema checks should gate workflow start.
- Policy hooks remain in workflow definitions and must be evaluated before each node action.
- Trace IDs and run IDs must be attached to all orchestration logs for auditability.

## Recommended Next Step (Non-breaking)

Introduce an **Orchestrator SPI** with adapters for:

- local file queue (existing)
- durable DB queue (future)
- external queue broker (future)

The SPI should preserve deterministic replay by requiring canonical task serialization and stable ordering semantics.

