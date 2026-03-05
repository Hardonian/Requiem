# Permission Broker

Permission escalation is brokered and never auto-granted.

`permission_request` fields:

- `permission_type`
- `resource`
- `required_scope`
- `reason`
- `recommended_minimum_grant`
- `origin_tool_event`
- `risk_classification`
- `approval_required`

CLI:

- `rq permission list`
- `rq permission approve <request_id>`
- `rq permission deny <request_id>`

All permission requests and decisions are append-only `.ndjson` records and include fingerprint diffs.
