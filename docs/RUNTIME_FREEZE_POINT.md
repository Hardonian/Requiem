# RUNTIME FREEZE POINT

Freeze rules:

- Receipt schema: versioned and backward-compatible within major line.
- WAL schema: append-only evolution; incompatible changes require migration.
- Proof pack schema: explicit version field, additive changes preferred.
- Invariant spec: changes require version bump + compatibility notes.

Breaking process:

1. Bump relevant version constants.
2. Add migration note.
3. Add invariant tests for old/new compatibility.
4. Fail CI if migration evidence absent.
