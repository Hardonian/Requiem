create extension if not exists pgcrypto;

create table if not exists public.tenants (
  tenant_id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.repos (
  tenant_id text not null references public.tenants(tenant_id) on delete cascade,
  repo_id uuid primary key default gen_random_uuid(),
  owner text not null,
  name text not null,
  full_name text not null,
  is_fork boolean not null default false,
  fork_parent_full_name text,
  default_branch text,
  topics jsonb not null default '[]'::jsonb,
  languages jsonb not null default '{}'::jsonb,
  archived boolean not null default false,
  homepage text,
  description text,
  created_at timestamptz,
  updated_at timestamptz,
  last_synced_at timestamptz not null default now(),
  monorepo_signals jsonb not null default '{}'::jsonb,
  unique (tenant_id, full_name)
);

create table if not exists public.repo_edges (
  tenant_id text not null references public.tenants(tenant_id) on delete cascade,
  edge_id uuid primary key default gen_random_uuid(),
  from_repo_full_name text not null,
  to_repo_full_name text not null,
  edge_type text not null,
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  evidence jsonb not null,
  evidence_hash text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, from_repo_full_name, to_repo_full_name, edge_type, evidence_hash)
);

create table if not exists public.prs (
  tenant_id text not null references public.tenants(tenant_id) on delete cascade,
  pr_id uuid primary key default gen_random_uuid(),
  repo_full_name text not null,
  number int not null,
  state text not null,
  merged_at timestamptz,
  author_login text,
  base_branch text,
  head_branch text,
  labels jsonb not null default '[]'::jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  unique (tenant_id, repo_full_name, number)
);

create table if not exists public.issues (
  tenant_id text not null references public.tenants(tenant_id) on delete cascade,
  issue_id uuid primary key default gen_random_uuid(),
  repo_full_name text not null,
  number int not null,
  state text not null,
  author_login text,
  labels jsonb not null default '[]'::jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  closed_at timestamptz,
  unique (tenant_id, repo_full_name, number)
);

create table if not exists public.repo_rollups (
  tenant_id text not null references public.tenants(tenant_id) on delete cascade,
  repo_full_name text not null,
  commits_30d int not null default 0,
  prs_30d int not null default 0,
  issues_30d int not null default 0,
  active_authors_30d int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, repo_full_name)
);

create table if not exists public.test_cases (
  tenant_id text not null references public.tenants(tenant_id) on delete cascade,
  case_id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  relationship_type text not null,
  difficulty int not null check (difficulty between 1 and 5),
  seed text not null,
  references jsonb not null,
  expected_outcome jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_repos_full_name on public.repos (tenant_id, full_name);
create index if not exists idx_repo_edges_from on public.repo_edges (tenant_id, from_repo_full_name);
create index if not exists idx_repo_edges_to on public.repo_edges (tenant_id, to_repo_full_name);
create index if not exists idx_prs_repo_number on public.prs (tenant_id, repo_full_name, number);
create index if not exists idx_issues_repo_number on public.issues (tenant_id, repo_full_name, number);

alter table public.tenants enable row level security;
alter table public.repos enable row level security;
alter table public.repo_edges enable row level security;
alter table public.prs enable row level security;
alter table public.issues enable row level security;
alter table public.repo_rollups enable row level security;
alter table public.test_cases enable row level security;

create policy tenants_tenant_isolation on public.tenants
  for all using (tenant_id = coalesce(auth.jwt()->>'tenant_id', ''))
  with check (tenant_id = coalesce(auth.jwt()->>'tenant_id', ''));

create policy repos_tenant_isolation on public.repos
  for all using (tenant_id = coalesce(auth.jwt()->>'tenant_id', ''))
  with check (tenant_id = coalesce(auth.jwt()->>'tenant_id', ''));

create policy repo_edges_tenant_isolation on public.repo_edges
  for all using (tenant_id = coalesce(auth.jwt()->>'tenant_id', ''))
  with check (tenant_id = coalesce(auth.jwt()->>'tenant_id', ''));

create policy prs_tenant_isolation on public.prs
  for all using (tenant_id = coalesce(auth.jwt()->>'tenant_id', ''))
  with check (tenant_id = coalesce(auth.jwt()->>'tenant_id', ''));

create policy issues_tenant_isolation on public.issues
  for all using (tenant_id = coalesce(auth.jwt()->>'tenant_id', ''))
  with check (tenant_id = coalesce(auth.jwt()->>'tenant_id', ''));

create policy repo_rollups_tenant_isolation on public.repo_rollups
  for all using (tenant_id = coalesce(auth.jwt()->>'tenant_id', ''))
  with check (tenant_id = coalesce(auth.jwt()->>'tenant_id', ''));

create policy test_cases_tenant_isolation on public.test_cases
  for all using (tenant_id = coalesce(auth.jwt()->>'tenant_id', ''))
  with check (tenant_id = coalesce(auth.jwt()->>'tenant_id', ''));
