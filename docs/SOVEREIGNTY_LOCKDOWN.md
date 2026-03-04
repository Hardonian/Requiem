# SOVEREIGNTY LOCKDOWN

Added `scripts/verify-sovereignty.mjs` and wired it into root `pnpm verify`.

Checks enforced:

1. ReadyLayer must not import CLI DB write repositories.
2. CLI modules outside kernel path must not call `LearningSignalRepository.create(...)` directly.

This creates a CI gate that fails when write-path sovereignty boundaries are crossed.
