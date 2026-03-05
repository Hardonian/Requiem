# Tool Failure Intelligence Runtime

Agents break at tool boundaries. Requiem now treats tool failures as kernel primitives so developers can **Run → Replay → Diagnose → Repair → Prove → Diff** with deterministic records.

## Primitive

Each tool invocation records a `ToolEvent` with stable IDs and hashes:
- run/step/trace IDs
- args hash + redacted preview
- status (`ok|failed|blocked|partial`)
- normalized error
- failure class + subclass
- structured diagnosis
- safe repair plan + plan fingerprint
- env/policy fingerprints

Schema reference: `packages/ai/src/tools/failure-taxonomy.schema.json`.

## Security posture

- Least privilege only; repair plans never auto-escalate.
- Sensitive tokens/keys are redacted from error strings and args previews.
- Tenant context still derives from invocation context, not request payload body.

## Deterministic replay boundaries

Classification is a pure mapping on normalized error text and tool name.
Replay should resurface the same failure class/subclass for equivalent normalized inputs.
Wall-clock timestamps are excluded from incident proof fingerprints.

## CLI verbs

```bash
# Run tool (events recorded automatically)
rq run system.echo '{"message":"hello"}'

# Diagnose tool failures for one run
rq diagnose <run_id> --json

# Preflight environment for a tool
rq doctor --tool web.fetch --json

# Preview or apply safe repair plan
rq repair <run_id> --plan --json
rq repair <run_id> --apply --json

# Compare failure behavior across runs
rq diff <runA> <runB> --json

# Export incident/proof pack
rq incident export <run_id>
```

## Failure taxonomy

Top-level classes:
`permission_error`, `dependency_error`, `interface_error`, `network_error`, `rate_limit_error`, `timeout_error`, `tool_logic_error`, `partial_execution_error`, `guardrail_block`, `determinism_break`, `storage_error`, `concurrency_error`, `planning_error`, `unknown_error`.

See schema for subclasses.
