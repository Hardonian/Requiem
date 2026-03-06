# Trigger System Integration Notes

This patch does not add persistence tables for triggers, but it introduces critical triggerability metadata in insight contracts:

- `manual_trigger_available`
- `auto_trigger_available`
- `auto_trigger_blocked_reason`

These fields are now produced by `generateActionableInsights` and surfaced via `/api/control-plane/insights`.

## Product behavior enabled
- UI can present manual fallback when auto-trigger is blocked.
- Governance policy can reason about why automation is currently disabled.
- Operators can route to setup/remediation pages using `deep_link_target`.
