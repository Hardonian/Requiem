# Failure Taxonomy

Canonical classes:

- `permission_error`
- `dependency_error`
- `interface_error`
- `network_error`
- `rate_limit_error`
- `timeout_error`
- `tool_logic_error`
- `partial_execution_error`
- `guardrail_block`
- `determinism_break`
- `storage_error`
- `concurrency_error`
- `planning_error`
- `unknown_error`

Registry metrics (`rq failures`):

- tool failure frequency
- top subclasses
- mean time to repair
- repair success rate
- environment drift indicators

No secrets are persisted in classifier output or registry records.
