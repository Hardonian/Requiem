# Replay Lab (Operator Workflow)

This pass introduces typed failure handling for replay artifact gaps:
- `REPLAY_ARTIFACT_MISSING`

When returned, prefer:
1. partial replay mode
2. explicit disclosure that deterministic replay cannot be guaranteed
3. settings action to enable future artifact persistence
