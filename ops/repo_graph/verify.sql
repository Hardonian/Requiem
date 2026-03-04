-- Usage: psql "$SUPABASE_DB_URL" -v tenant_id='public-hardonian' -f ops/repo_graph/verify.sql
\echo 'repos ingested'
select count(*) as repos_count
from public.repos
where tenant_id = :'tenant_id';

\echo 'edges by type'
select edge_type, count(*) as edge_count
from public.repo_edges
where tenant_id = :'tenant_id'
group by edge_type
order by edge_count desc, edge_type asc;

\echo 'top 10 parents by child count (fork_of)'
select to_repo_full_name as parent_repo, count(*) as child_count
from public.repo_edges
where tenant_id = :'tenant_id' and edge_type = 'fork_of'
group by to_repo_full_name
order by child_count desc, parent_repo asc
limit 10;

\echo 'top 10 repos with most related edges (non-fork)'
select from_repo_full_name as repo_full_name, count(*) as related_edges
from public.repo_edges
where tenant_id = :'tenant_id' and edge_type <> 'fork_of'
group by from_repo_full_name
order by related_edges desc, repo_full_name asc
limit 10;

\echo 'sample test cases joined to evidence'
select t.case_id, t.relationship_type, t.title, e.edge_type, e.confidence, e.evidence
from public.test_cases t
left join public.repo_edges e
  on e.tenant_id = t.tenant_id
 and e.from_repo_full_name = t.references->>'from_repo_full_name'
 and e.to_repo_full_name = t.references->>'to_repo_full_name'
where t.tenant_id = :'tenant_id'
order by t.created_at desc
limit 10;

\echo 'determinism checksums'
with hashes as (
  select 'repos' as table_name,
         md5(string_agg(md5(row_to_json(r)::text), '' order by r.full_name)) as checksum
  from public.repos r where r.tenant_id = :'tenant_id'
  union all
  select 'repo_edges',
         md5(string_agg(md5(row_to_json(e)::text), '' order by e.from_repo_full_name, e.to_repo_full_name, e.edge_type, e.evidence_hash))
  from public.repo_edges e where e.tenant_id = :'tenant_id'
  union all
  select 'prs',
         md5(string_agg(md5(row_to_json(p)::text), '' order by p.repo_full_name, p.number))
  from public.prs p where p.tenant_id = :'tenant_id'
  union all
  select 'issues',
         md5(string_agg(md5(row_to_json(i)::text), '' order by i.repo_full_name, i.number))
  from public.issues i where i.tenant_id = :'tenant_id'
  union all
  select 'repo_rollups',
         md5(string_agg(md5(row_to_json(rr)::text), '' order by rr.repo_full_name))
  from public.repo_rollups rr where rr.tenant_id = :'tenant_id'
  union all
  select 'test_cases',
         md5(string_agg(md5(row_to_json(tc)::text), '' order by tc.case_id))
  from public.test_cases tc where tc.tenant_id = :'tenant_id'
)
select * from hashes order by table_name;
