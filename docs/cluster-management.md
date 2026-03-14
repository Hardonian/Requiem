# Cluster Management

## Core loop

1. `requiem status` to verify baseline health.
2. `requiem doctor` to capture actionable diagnostics.
3. `requiem inspect <artifact>` for execution-level root-cause analysis.
4. `requiem repair <run_id> --apply` only after reviewing suggested safe plan.

## Failure domains covered

- CAS corruption
- worker failures
- policy engine errors
- adapter failures

Use `requiem status --json` and `requiem doctor --json` for automation hooks.
