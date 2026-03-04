# Repo Lineage Graph Ingestion

This workflow builds a deterministic, tenant-scoped repository-lineage dataset for a specified GitHub owner.

> `Hardonia` / `Hardonian` (your account naming in notes vs GitHub handle) is documented here only as your **test owner case** for validating pipeline workflow. It is not a universal/default tenant or owner.

## What it collects
- Public repos for a target owner (user or org) plus orgs discovered from `GET /users/<target>/orgs`.
- Repo metadata, language/topic snapshots, fork parent/child relationships.
- Git evidence from shallow clones: `.gitmodules`, origin remote URL, monorepo signals.
- Dependency + docs link edges from manifests and READMEs.
- PR and issue metadata rollups.
- Deterministic synthetic test cases seeded by `--seed`.

## Evidence confidence rubric (deterministic)
- `fork_of`: `1.0` (strong)
- `submodule_depends_on`: `0.95` (strong)
- `package_depends_on_repo`: `0.8` (medium/strong)
- `remote_points_to`: `0.7` (medium)
- `doc_links_to`: `0.45` (weak)

## Tenant isolation
- Ingestion tenant is explicitly supplied via `--tenant-id` (default: `public-github-lineage`).
- Future API handlers must derive tenant from auth context (`auth.jwt()->>'tenant_id'`) and must **never** trust request body tenant ids.
- RLS policies in `schema.sql` enforce row access by `tenant_id`.

## Prerequisites
- Python 3.10+
- `git`
- Optional for authenticated GitHub access: `GITHUB_TOKEN` or `GH_TOKEN`
- Optional for direct Supabase ingestion: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

## Run
```bash
python3 ops/repo_graph/ingest.py \
  --target Hardonian \
  --tenant-id public-owner-test \
  --seed hardonian-lineage-v1
```

Outputs:
- `ops/repo_graph/out/*.jsonl`
- `ops/repo_graph/runlog.json`

If Supabase credentials are missing, the script intentionally exits non-zero **after** writing local datasets.

## Test profiles
- Your test-owner workflow (Hardonia/Hardonian): `python3 ops/repo_graph/ingest.py --target Hardonian --tenant-id public-owner-test --seed hardonian-lineage-v1`
- Any other owner workflow: `python3 ops/repo_graph/ingest.py --target octocat --tenant-id public-owner-test --seed repo-lineage-v1`

## Supabase setup
Apply schema:
```bash
psql "$SUPABASE_DB_URL" -f ops/repo_graph/schema.sql
```

Verify dataset:
```bash
psql "$SUPABASE_DB_URL" -v tenant_id='public-owner-test' -f ops/repo_graph/verify.sql
```

> Ingestion should run server-side with service role key only.

## Idempotency
- Deterministic UUIDs are derived from stable keys.
- `repo_edges` unique key includes `(tenant_id, from, to, type, evidence_hash)`.
- Other tables have tenant-scoped unique constraints.

## Logs
- `ops/repo_graph/runlog.json` includes run_id, timestamps, counts, failures, and per-table checksums.
