# Dataset Catalog

Deterministic datasets runnable via `rl dataset gen <CODE> --seed <N>` and `rl dataset validate <CODE> --seed <N>`.

## Core weekly set (required)

1. POL-TENANT-ISOLATION
2. POL-ROLE-ESCALATION
3. TOOL-SCHEMA-STRESS
4. ADV-INJECT-BASIC
5. ADV-PATH-TRAVERSAL
6. REPO-DAG-CIRCULAR
7. CLI-PIPE-PRESSURE
8. PERF-COLD-START
9. FAULT-OOM-SCENARIO
10. TRACE-ROUNDTRIP

These are registered in `packages/testdata/src/datasets/index.ts` and shipped as built-in datasets.

## Learning funnel synthetic datasets

The learning suite consumes deterministic rows using CAS-addressed dataset artifacts with fields:
- `id`
- `tenant_id`
- `model_id`
- `feature_key`
- `feature_value`
- `raw_score`
- `predicted`
- `actual`
- `confidence`
- `ts`

Generation must be seeded and stably sorted before CAS persistence.

## Example (inline generation)

```bash
rl learning train weights --model model-default --dataset <cas> --seed 42 --lr 0.05 --iters 50
rl learning calibrate --model model-default --dataset <cas> --method bayesian_beta --seed 42
rl learning error-bands --model model-default --mc 200 --seed 42
```
