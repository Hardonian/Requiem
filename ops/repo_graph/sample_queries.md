# Sample Queries

```sql
-- Repos with strongest outgoing lineage evidence
select r.full_name,
       count(*) filter (where e.edge_type = 'fork_of') as fork_edges,
       count(*) filter (where e.edge_type = 'submodule_depends_on') as submodule_edges,
       count(*) as total_edges
from public.repos r
left join public.repo_edges e
  on e.tenant_id = r.tenant_id and e.from_repo_full_name = r.full_name
where r.tenant_id = '<tenant_id>'
group by r.full_name
order by total_edges desc, r.full_name asc;
```

```sql
-- Candidate canonical parent/child pairs
select from_repo_full_name as child_repo,
       to_repo_full_name as parent_repo,
       edge_type,
       confidence
from public.repo_edges
where tenant_id = '<tenant_id>'
  and edge_type in ('fork_of', 'submodule_depends_on')
order by confidence desc, child_repo asc;
```

```sql
-- Recent activity rank
select repo_full_name,
       commits_30d,
       prs_30d,
       issues_30d,
       active_authors_30d
from public.repo_rollups
where tenant_id = '<tenant_id>'
order by commits_30d desc, prs_30d desc, repo_full_name asc;
```

```sql
-- Test cases by relationship type
select relationship_type, difficulty, count(*)
from public.test_cases
where tenant_id = '<tenant_id>'
group by relationship_type, difficulty
order by relationship_type, difficulty;
```
