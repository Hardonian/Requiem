# Replay Architecture

Replay executions use deterministic inputs and can optionally use deterministic timestamping.

Fields:
- `logical_time`: monotonic operator timeline.
- `replay_time`: deterministic replay timeline seed + logical offset.
