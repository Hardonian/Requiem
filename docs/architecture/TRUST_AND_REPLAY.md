# Trust and Replay Integration (Current Pass)

The existing repo already supports run/replay/policy/audit surfaces. This pass strengthens trust/replay productization by:

- classifying replay-data failures as `REPLAY_ARTIFACT_MISSING`
- exposing insight contracts that can direct users to replay and settings actions
- normalizing readiness and failure reasoning for replay-adjacent remediation paths

Future step: attach these insights directly to proof explorer and replay diff UI panels.
