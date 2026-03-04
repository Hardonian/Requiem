#!/usr/bin/env python3
import argparse
import datetime as dt
import hashlib
import json
import os
import random
import re
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

DEFAULT_TENANT_ID = "public-github-lineage"
DEFAULT_SEED = "repo-lineage-v1"
TENANT_ID = DEFAULT_TENANT_ID
SEED = DEFAULT_SEED
GITHUB_API = "https://api.github.com"
MAX_PER_PAGE = 100
MAX_PRS_PER_REPO = 200
MAX_ISSUES_PER_REPO = 200

EDGE_CONFIDENCE = {
    "fork_of": 1.0,
    "submodule_depends_on": 0.95,
    "remote_points_to": 0.7,
    "doc_links_to": 0.45,
    "package_depends_on_repo": 0.8,
}

GITHUB_REPO_URL_RE = re.compile(r"https?://github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)")
OWNER_REPO_RE = re.compile(r"\b([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)\b")


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def deterministic_uuid(*parts: str) -> str:
    joined = "::".join(parts)
    digest = hashlib.sha256(joined.encode("utf-8")).hexdigest()
    return str(uuid.UUID(digest[:32]))


def sha256_json(obj: Any) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


class GitHubClient:
    def __init__(self, token: Optional[str], run_id: str):
        self.token = token
        self.run_id = run_id
        self.etags: Dict[str, str] = {}

    def _request(self, url: str) -> Tuple[Any, Dict[str, str]]:
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": f"repo-lineage-agent/{self.run_id}",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if url in self.etags:
            headers["If-None-Match"] = self.etags[url]
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req) as resp:
                body = resp.read().decode("utf-8")
                if "ETag" in resp.headers:
                    self.etags[url] = resp.headers["ETag"]
                data = json.loads(body) if body else None
                return data, dict(resp.headers)
        except urllib.error.HTTPError as e:
            if e.code == 304:
                return None, {}
            if e.code == 202:
                return {"_deferred": True}, {}
            raise RuntimeError(f"GitHub HTTP error {e.code} for {url}") from e
        except urllib.error.URLError as e:
            raise RuntimeError(f"GitHub network error for {url}: {e}") from e

    def paged_get(self, url: str) -> List[Any]:
        results: List[Any] = []
        page = 1
        while True:
            sep = "&" if "?" in url else "?"
            page_url = f"{url}{sep}per_page={MAX_PER_PAGE}&page={page}"
            data, _ = self._request(page_url)
            if data is None:
                break
            if not isinstance(data, list):
                raise RuntimeError(f"Unexpected non-list paged response for {page_url}: {data}")
            if not data:
                break
            results.extend(data)
            if len(data) < MAX_PER_PAGE:
                break
            page += 1
        return results

    def get_json(self, path_or_url: str) -> Any:
        url = path_or_url if path_or_url.startswith("http") else f"{GITHUB_API}{path_or_url}"
        data, _ = self._request(url)
        return data


def parse_gitmodules(repo_dir: Path) -> List[Dict[str, Any]]:
    gm = repo_dir / ".gitmodules"
    if not gm.exists():
        return []
    out: List[Dict[str, Any]] = []
    section = None
    vals: Dict[str, str] = {}
    for idx, line in enumerate(gm.read_text(errors="ignore").splitlines(), start=1):
        stripped = line.strip()
        if stripped.startswith("[submodule"):
            if section and "url" in vals:
                out.append({"name": section, "path": vals.get("path"), "url": vals.get("url"), "line": idx})
            section = stripped
            vals = {}
        elif "=" in stripped:
            k, v = [x.strip() for x in stripped.split("=", 1)]
            vals[k] = v
    if section and "url" in vals:
        out.append({"name": section, "path": vals.get("path"), "url": vals.get("url"), "line": idx})
    return out


def extract_repo_links_with_lines(text: str) -> List[Dict[str, Any]]:
    links: List[Dict[str, Any]] = []
    for line_num, line in enumerate(text.splitlines(), start=1):
        for m in GITHUB_REPO_URL_RE.finditer(line):
            full = f"{m.group(1)}/{m.group(2).removesuffix('.git')}"
            links.append({"repo_full_name": full, "line": line_num, "raw": m.group(0)})
    return links


def parse_manifest_dependencies(path: Path) -> List[Dict[str, Any]]:
    deps: List[Dict[str, Any]] = []
    name = path.name.lower()
    text = path.read_text(errors="ignore")
    lines = text.splitlines()
    if name == "package.json":
        try:
            obj = json.loads(text)
            for block in ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]:
                for dep_name, dep_val in (obj.get(block) or {}).items():
                    s = str(dep_val)
                    m = GITHUB_REPO_URL_RE.search(s)
                    if m:
                        deps.append({"dependency": dep_name, "target": f"{m.group(1)}/{m.group(2).removesuffix('.git')}", "source": block})
                    elif dep_name.startswith("@") and "/" in dep_name:
                        continue
        except json.JSONDecodeError:
            pass
    elif name in {"requirements.txt", "go.mod", "cargo.toml", "pom.xml", "pyproject.toml"}:
        for i, line in enumerate(lines, start=1):
            for m in GITHUB_REPO_URL_RE.finditer(line):
                deps.append({"dependency": name, "target": f"{m.group(1)}/{m.group(2).removesuffix('.git')}", "line": i})
            if name == "go.mod":
                for m in OWNER_REPO_RE.finditer(line):
                    owner, repo = m.group(1), m.group(2)
                    if "." in owner:
                        continue
                    deps.append({"dependency": name, "target": f"{owner}/{repo}", "line": i})
    return deps


def clone_repo(clone_url: str, clone_path: Path) -> None:
    if clone_path.exists():
        shutil.rmtree(clone_path)
    cmd = ["git", "clone", "--depth", "1", "--no-tags", clone_url, str(clone_path)]
    subprocess.run(cmd, check=True, capture_output=True, text=True)


def get_origin_remote(repo_dir: Path) -> Optional[str]:
    cmd = ["git", "-C", str(repo_dir), "remote", "get-url", "origin"]
    p = subprocess.run(cmd, capture_output=True, text=True)
    return p.stdout.strip() if p.returncode == 0 else None


def parse_monorepo_signals(repo_dir: Path) -> Dict[str, bool]:
    return {
        "pnpm_workspace": (repo_dir / "pnpm-workspace.yaml").exists(),
        "turbo": (repo_dir / "turbo.json").exists(),
        "lerna": (repo_dir / "lerna.json").exists(),
        "nx": (repo_dir / "nx.json").exists(),
    }


def parse_repo(g: GitHubClient, repo: Dict[str, Any], clones_root: Path) -> Dict[str, Any]:
    full_name = repo["full_name"]
    owner, name = full_name.split("/", 1)
    detail = g.get_json(f"/repos/{owner}/{name}") or {}
    topics = detail.get("topics", [])
    languages = g.get_json(f"/repos/{owner}/{name}/languages") or {}

    clone_path = clones_root / full_name.replace("/", "__")
    clone_repo(repo["clone_url"], clone_path)

    submodules = parse_gitmodules(clone_path)
    origin = get_origin_remote(clone_path)
    monorepo = parse_monorepo_signals(clone_path)

    doc_links = []
    for readme_name in ["README.md", "README", "readme.md", "docs/README.md"]:
        p = clone_path / readme_name
        if p.exists():
            doc_links.extend([{**x, "source_file": readme_name} for x in extract_repo_links_with_lines(p.read_text(errors="ignore"))])

    manifests = []
    for mf in ["package.json", "requirements.txt", "go.mod", "Cargo.toml", "pom.xml", "pyproject.toml"]:
        for p in clone_path.rglob(mf):
            if ".git/" in str(p):
                continue
            manifests.extend([{**x, "source_file": str(p.relative_to(clone_path))} for x in parse_manifest_dependencies(p)])

    forks = g.paged_get(f"{GITHUB_API}/repos/{owner}/{name}/forks")

    pulls = g.paged_get(f"{GITHUB_API}/repos/{owner}/{name}/pulls?state=all")[:MAX_PRS_PER_REPO]
    issues = [i for i in g.paged_get(f"{GITHUB_API}/repos/{owner}/{name}/issues?state=all") if "pull_request" not in i][:MAX_ISSUES_PER_REPO]

    commit_activity = g.get_json(f"/repos/{owner}/{name}/stats/commit_activity")
    commits_30d = 0
    if isinstance(commit_activity, list) and commit_activity:
        commits_30d = sum(w.get("total", 0) for w in commit_activity[-4:])

    now = now_iso()
    return {
        "repo": {
            "tenant_id": TENANT_ID,
            "repo_id": deterministic_uuid(TENANT_ID, full_name, "repo"),
            "owner": owner,
            "name": name,
            "full_name": full_name,
            "is_fork": bool(repo.get("fork")),
            "fork_parent_full_name": (detail.get("parent") or {}).get("full_name"),
            "default_branch": repo.get("default_branch"),
            "topics": topics,
            "languages": languages,
            "created_at": repo.get("created_at"),
            "updated_at": repo.get("updated_at"),
            "last_synced_at": now,
            "description": repo.get("description"),
            "homepage": repo.get("homepage"),
            "archived": bool(repo.get("archived")),
            "monorepo_signals": monorepo,
        },
        "submodules": submodules,
        "origin_remote": origin,
        "doc_links": doc_links,
        "manifest_links": manifests,
        "forks": [{"full_name": f["full_name"]} for f in forks],
        "pulls": pulls,
        "issues": issues,
        "rollup": {
            "tenant_id": TENANT_ID,
            "repo_full_name": full_name,
            "commits_30d": commits_30d,
            "prs_30d": sum(1 for p in pulls if p.get("created_at", "") >= (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=30)).isoformat()),
            "issues_30d": sum(1 for i in issues if i.get("created_at", "") >= (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=30)).isoformat()),
            "active_authors_30d": len({(p.get("user") or {}).get("login") for p in pulls if (p.get("user") or {}).get("login")}),
            "updated_at": now,
        },
    }


def add_edge(edges: List[Dict[str, Any]], from_repo: str, to_repo: str, edge_type: str, evidence: Dict[str, Any]) -> None:
    evidence_hash = sha256_json(evidence)
    edges.append({
        "tenant_id": TENANT_ID,
        "edge_id": deterministic_uuid(TENANT_ID, from_repo, to_repo, edge_type, evidence_hash),
        "from_repo_full_name": from_repo,
        "to_repo_full_name": to_repo,
        "edge_type": edge_type,
        "confidence": EDGE_CONFIDENCE[edge_type],
        "evidence": evidence,
        "evidence_hash": evidence_hash,
        "created_at": now_iso(),
    })


def build_test_cases(edges: List[Dict[str, Any]], repos: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rng = random.Random(hashlib.sha256(SEED.encode()).hexdigest())
    by_type: Dict[str, List[Dict[str, Any]]] = {}
    for e in sorted(edges, key=lambda x: (x["edge_type"], x["from_repo_full_name"], x["to_repo_full_name"])):
        by_type.setdefault(e["edge_type"], []).append(e)
    cases: List[Dict[str, Any]] = []
    type_map = {
        "fork_of": "fork lineage",
        "package_depends_on_repo": "dependency",
        "doc_links_to": "docs link",
        "submodule_depends_on": "monorepo",
    }
    for edge_type, label in type_map.items():
        entries = by_type.get(edge_type, [])
        if not entries:
            continue
        choice = entries[rng.randrange(len(entries))]
        cid = deterministic_uuid(TENANT_ID, "case", edge_type, choice["from_repo_full_name"], choice["to_repo_full_name"])
        cases.append({
            "tenant_id": TENANT_ID,
            "case_id": cid,
            "title": f"Infer {label} for {choice['from_repo_full_name']}",
            "description": f"Determine relationship between {choice['from_repo_full_name']} and {choice['to_repo_full_name']}.",
            "relationship_type": label,
            "difficulty": min(5, max(1, int(round((1.0 - choice["confidence"]) * 5)) + 1)),
            "seed": SEED,
            "references": {
                "from_repo_full_name": choice["from_repo_full_name"],
                "to_repo_full_name": choice["to_repo_full_name"],
                "evidence": choice["evidence"],
            },
            "expected_outcome": {
                "edge_type": choice["edge_type"],
                "confidence": choice["confidence"],
                "canonical_parent_child": choice["edge_type"] == "fork_of",
            },
            "created_at": now_iso(),
        })
    if repos:
        r = sorted(repos, key=lambda x: x["full_name"])[0]
        cases.append({
            "tenant_id": TENANT_ID,
            "case_id": deterministic_uuid(TENANT_ID, "case", "unknown", r["full_name"]),
            "title": f"Unknown relationship baseline for {r['full_name']}",
            "description": "Confirm no forced parent-child without strong evidence.",
            "relationship_type": "unknown",
            "difficulty": 2,
            "seed": SEED,
            "references": {"repo_full_name": r["full_name"]},
            "expected_outcome": {"classification": "related_or_none"},
            "created_at": now_iso(),
        })
    return cases


def write_jsonl(path: Path, rows: List[Dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, sort_keys=True) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", required=True, help="GitHub user/org to ingest (example test owner: Hardonian)")
    parser.add_argument("--tenant-id", default=DEFAULT_TENANT_ID)
    parser.add_argument("--seed", default=DEFAULT_SEED)
    parser.add_argument("--output", default="ops/repo_graph/out")
    parser.add_argument("--clones", default="ops/repo_graph/clones")
    args = parser.parse_args()

    global TENANT_ID, SEED
    TENANT_ID = args.tenant_id
    SEED = args.seed

    run_id = f"run-{dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:8]}"
    start = now_iso()
    out_dir = Path(args.output)
    clones_root = Path(args.clones)
    out_dir.mkdir(parents=True, exist_ok=True)
    clones_root.mkdir(parents=True, exist_ok=True)

    token = os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN")
    g = GitHubClient(token=token, run_id=run_id)

    targets = [args.target]
    runlog_path = Path("ops/repo_graph") / "runlog.json"

    try:
        discovered_orgs = g.get_json(f"/users/{args.target}/orgs") or []
    except Exception as e:
        failure_runlog = {
            "run_id": run_id,
            "tenant_id": TENANT_ID,
            "seed": SEED,
            "started_at": start,
            "finished_at": now_iso(),
            "target": args.target,
            "targets_discovered": [args.target],
            "github_auth": bool(token),
            "repos_count": 0,
            "edges_count": 0,
            "edges_by_type": {k: 0 for k in sorted(EDGE_CONFIDENCE)},
            "prs_count": 0,
            "issues_count": 0,
            "test_cases_count": 0,
            "failures": [{"stage": "discover_targets", "error": str(e)}],
            "table_hashes": {},
        }
        runlog_path.write_text(json.dumps(failure_runlog, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(json.dumps({"run_id": run_id, "error": str(e)}, indent=2, sort_keys=True), file=sys.stderr)
        return 1
    for org in sorted((o.get("login") for o in discovered_orgs if o.get("login"))):
        if org not in targets:
            targets.append(org)

    repos_raw: List[Dict[str, Any]] = []
    for t in targets:
        user = g.get_json(f"/users/{t}")
        if user and user.get("type") == "Organization":
            repos_raw.extend(g.paged_get(f"{GITHUB_API}/orgs/{t}/repos?type=public&sort=full_name&direction=asc"))
        else:
            repos_raw.extend(g.paged_get(f"{GITHUB_API}/users/{t}/repos?type=owner&sort=full_name&direction=asc"))

    dedup = {}
    for r in repos_raw:
        dedup[r["full_name"]] = r
    repos_list = [dedup[k] for k in sorted(dedup)]

    parsed = []
    failures = []
    for r in repos_list:
        try:
            parsed.append(parse_repo(g, r, clones_root))
        except Exception as e:
            failures.append({"repo": r.get("full_name"), "error": str(e)})

    repos = [p["repo"] for p in parsed]
    prs = []
    issues = []
    rollups = [p["rollup"] for p in parsed]
    edges: List[Dict[str, Any]] = []

    for p in parsed:
        rf = p["repo"]["full_name"]
        if p["repo"].get("fork_parent_full_name"):
            add_edge(edges, rf, p["repo"]["fork_parent_full_name"], "fork_of", {"source": "github_repo_metadata", "field": "parent.full_name"})
        for child in sorted(p["forks"], key=lambda x: x["full_name"]):
            add_edge(edges, child["full_name"], rf, "fork_of", {"source": "github_repo_forks_api", "repo": rf})
        for sm in sorted(p["submodules"], key=lambda x: (x.get("url") or "", x.get("path") or "")):
            m = GITHUB_REPO_URL_RE.search(sm.get("url") or "")
            if m:
                target = f"{m.group(1)}/{m.group(2).removesuffix('.git')}"
                add_edge(edges, rf, target, "submodule_depends_on", {"source_file": ".gitmodules", "path": sm.get("path"), "url": sm.get("url"), "line": sm.get("line")})
        if p.get("origin_remote"):
            m = GITHUB_REPO_URL_RE.search(p["origin_remote"])
            if m:
                target = f"{m.group(1)}/{m.group(2).removesuffix('.git')}"
                add_edge(edges, rf, target, "remote_points_to", {"source": "git_remote_origin", "url": p["origin_remote"]})
        for dl in sorted(p["doc_links"], key=lambda x: (x["repo_full_name"], x["source_file"], x["line"])):
            add_edge(edges, rf, dl["repo_full_name"], "doc_links_to", {"source_file": dl["source_file"], "line": dl["line"], "raw": dl["raw"]})
        for dep in sorted(p["manifest_links"], key=lambda x: (x["target"], x.get("source_file", ""), x.get("line", 0))):
            add_edge(edges, rf, dep["target"], "package_depends_on_repo", {"source_file": dep.get("source_file"), "dependency": dep.get("dependency"), "line": dep.get("line")})

        for pr in p["pulls"]:
            prs.append({
                "tenant_id": TENANT_ID,
                "pr_id": deterministic_uuid(TENANT_ID, rf, "pr", str(pr["number"])),
                "repo_full_name": rf,
                "number": pr["number"],
                "state": pr.get("state"),
                "merged_at": pr.get("merged_at"),
                "author_login": (pr.get("user") or {}).get("login"),
                "base_branch": (pr.get("base") or {}).get("ref"),
                "head_branch": (pr.get("head") or {}).get("ref"),
                "labels": [l.get("name") for l in pr.get("labels", [])],
                "created_at": pr.get("created_at"),
                "updated_at": pr.get("updated_at"),
            })
        for issue in p["issues"]:
            issues.append({
                "tenant_id": TENANT_ID,
                "issue_id": deterministic_uuid(TENANT_ID, rf, "issue", str(issue["number"])),
                "repo_full_name": rf,
                "number": issue["number"],
                "state": issue.get("state"),
                "author_login": (issue.get("user") or {}).get("login"),
                "labels": [l.get("name") for l in issue.get("labels", [])],
                "created_at": issue.get("created_at"),
                "updated_at": issue.get("updated_at"),
                "closed_at": issue.get("closed_at"),
            })

    unique_edges = {}
    for e in edges:
        key = (e["from_repo_full_name"], e["to_repo_full_name"], e["edge_type"], e["evidence_hash"])
        unique_edges[key] = e
    edges = [unique_edges[k] for k in sorted(unique_edges)]

    test_cases = build_test_cases(edges, repos)

    tenants = [{"tenant_id": TENANT_ID, "name": f"Public GitHub lineage ({args.target})", "created_at": start}]

    write_jsonl(out_dir / "tenants.jsonl", tenants)
    write_jsonl(out_dir / "repos.jsonl", repos)
    write_jsonl(out_dir / "repo_edges.jsonl", edges)
    write_jsonl(out_dir / "prs.jsonl", prs)
    write_jsonl(out_dir / "issues.jsonl", issues)
    write_jsonl(out_dir / "repo_rollups.jsonl", rollups)
    write_jsonl(out_dir / "test_cases.jsonl", test_cases)

    table_hashes = {}
    for table in ["repos", "repo_edges", "prs", "issues", "repo_rollups", "test_cases"]:
        p = out_dir / f"{table}.jsonl"
        table_hashes[table] = hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None

    runlog = {
        "run_id": run_id,
        "tenant_id": TENANT_ID,
        "seed": SEED,
        "started_at": start,
        "finished_at": now_iso(),
        "target": args.target,
        "targets_discovered": targets,
        "github_auth": bool(token),
        "repos_count": len(repos),
        "edges_count": len(edges),
        "edges_by_type": {k: sum(1 for e in edges if e["edge_type"] == k) for k in sorted(EDGE_CONFIDENCE)},
        "prs_count": len(prs),
        "issues_count": len(issues),
        "test_cases_count": len(test_cases),
        "failures": failures,
        "table_hashes": table_hashes,
    }
    runlog_path.write_text(json.dumps(runlog, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    print(json.dumps({
        "run_id": run_id,
        "repos_count": len(repos),
        "edges_by_type": runlog["edges_by_type"],
        "test_cases_count": len(test_cases),
    }, indent=2, sort_keys=True))

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        print(
            f"ERROR run_id={run_id}: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY missing. Local JSONL dataset written to {out_dir}.",
            file=sys.stderr,
        )
        return 2

    print(f"Supabase credentials detected for run_id={run_id}, but REST ingestion is not configured in this script.", file=sys.stderr)
    return 3


if __name__ == "__main__":
    sys.exit(main())
