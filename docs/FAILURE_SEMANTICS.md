# FAILURE SEMANTICS

Failure handling principles for irreversible runtime behavior:

- Deterministic classification codes.
- No partial mutation on failed write paths.
- Return Problem+JSON with `trace_id` (never hard-500 payloads).
- Keep replay mismatches and capability denials auditable.

This pass locks Problem+JSON payload construction to one canonical builder.
