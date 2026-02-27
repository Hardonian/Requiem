# ready-layer/migrations/

Database migration files for ReadyLayer Cloud.

## Policy

- Migration files are **append-only**. Once committed and registered in
  `contracts/migration.policy.json`, a migration file may **never** be modified
  or deleted. To reverse a migration, add a new migration file.

- Every migration file must be registered in `contracts/migration.policy.json`
  under the `db_migrations` array before merging to main.

- Migration files must follow the naming convention:
  ```
  NNN_description.sql          (SQL migrations)
  NNN_description.migration.ts (TypeScript migrations)
  ```
  where `NNN` is a zero-padded sequence number (e.g. `001`, `002`).

- CI enforces this policy via `scripts/verify_migrations.sh`.

## Adding a Migration

1. Create the migration file with the next sequence number.
2. Add an entry to `contracts/migration.policy.json` → `db_migrations`.
3. Run `scripts/verify_migrations.sh` locally to confirm it passes.
4. PR footer must include: `Migration: <NNN_description> type=db`

## Schema Notes

The ReadyLayer Cloud database schema will be defined here when the first
persistent store is introduced. The current implementation uses stateless
API proxying to the engine (no local database required for the MVP).

When a DB schema is introduced:
- Use `001_initial_schema.sql` as the baseline migration.
- Document the schema in `docs/ARCHITECTURE.md`.
- Add Zod runtime validators in `ready-layer/src/lib/` for all DB-bound types.
