# Storage Backend Assumptions

## Backends under test

- **Filesystem CAS on disk**
  - Backend: host filesystem path under `bench/durability/*/cas`.
  - Assumption: atomic rename on same mount.
  - Validation mode: real process kill with deterministic failpoints.

- **SQLite on disk**
  - Backend: `bench/durability/sqlite/durability.db`.
  - Assumption: WAL mode is enabled when available.
  - Validation mode: sqlite3 CLI probe executes `PRAGMA journal_mode=WAL` and a write transaction.

- **Postgres (optional in current env)**
  - Backend: DSN from `REQUIEM_DURABILITY_POSTGRES_DSN`.
  - Assumption: transactional durability semantics owned by Postgres configuration.
  - Validation mode: enabled in CI/manual environments where DSN is provided.

## Filesystem details captured in artifacts

`bench/recovery-report.json` and `bench/crash-matrix-report.json` include host platform metadata and backend matrix status.

## Residual bounded risk

- Filesystem behavior differs across mount options and hardware write caches.
- Postgres fault injection is environment-gated by DSN availability.
- Host/container power-loss equivalence is approximated with SIGKILL in this suite; VM hard-stop scenarios remain manual truth runs unless CI environment adds that capability.
