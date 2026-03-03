import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { request as httpsRequest } from 'node:https';
import type { IncomingHttpHeaders } from 'node:http';
import { spawnSync } from 'node:child_process';
import { hash } from '../lib/hash.js';

type FetchMode = 'none' | 'shallow' | 'full';
type OwnerType = 'User' | 'Organization';
type EdgeType =
  | 'fork_parent'
  | 'fork_source'
  | 'submodule'
  | 'dependency'
  | 'readme_link'
  | 'git_remote'
  | 'commit_reference';
type EvidenceType =
  | 'fork_metadata'
  | 'submodule'
  | 'dependency'
  | 'readme_link'
  | 'git_remote'
  | 'commit_reference';

interface IngestLineageOptions {
  tenantId: string;
  owner: string;
  runId?: string;
  artifactsRoot: string;
  fetchMode: FetchMode;
  discoverOrgs: boolean;
  includeCommitReferences: boolean;
  commitLimit: number;
  repoLimit?: number;
  githubToken?: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  noSupabase: boolean;
  cloneRoot?: string;
  cloneTimeoutSeconds: number;
}

interface HttpResponse {
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: string;
}

interface GitHubOwner {
  login: string;
  type: OwnerType;
}

interface GitHubOrg {
  login: string;
}

interface GitHubRepoRef {
  full_name: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  fork: boolean;
  private: boolean;
  visibility?: string;
  owner: {
    login: string;
    type: string;
  };
  parent?: GitHubRepoRef | null;
  source?: GitHubRepoRef | null;
  topics?: string[];
  stargazers_count?: number;
  forks_count?: number;
  archived?: boolean;
  disabled?: boolean;
}

interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
  };
}

interface RepoNode {
  stable_hash: string;
  tenant_id: string;
  repo_full_name: string;
  repo_owner: string;
  repo_name: string;
  is_scanned: boolean;
  is_fork: boolean;
  parent_full_name: string | null;
  source_full_name: string | null;
  html_url: string | null;
  default_branch: string | null;
  visibility: string | null;
  topics: string[];
  metadata: Record<string, unknown>;
}

interface EdgeRow {
  stable_hash: string;
  tenant_id: string;
  source_repo_full_name: string;
  target_repo_full_name: string;
  edge_type: EdgeType;
  evidence_count: number;
  metadata: Record<string, unknown>;
}

interface EdgeAccumulator {
  edge: Omit<EdgeRow, 'evidence_count'>;
  evidenceHashes: Set<string>;
}

interface EvidenceRow {
  stable_hash: string;
  edge_stable_hash: string;
  tenant_id: string;
  source_repo_full_name: string;
  target_repo_full_name: string;
  evidence_type: EvidenceType;
  evidence_value: string;
  location: string;
  details: Record<string, unknown>;
}

interface EvidenceInput {
  sourceRepo: string;
  targetRepo: string;
  edgeType: EdgeType;
  evidenceType: EvidenceType;
  evidenceValue: string;
  location: string;
  details: Record<string, unknown>;
}

interface PipelineResult {
  runId: string;
  artifactDir: string;
  ownersScanned: string[];
  reposScanned: number;
  reposCloned: number;
  cloneFailures: string[];
  nodes: RepoNode[];
  edges: EdgeRow[];
  evidence: EvidenceRow[];
  summary: Record<string, unknown>;
  files: Array<{ path: string; bytes: number; sha: string }>;
}

interface DiscoveryResult {
  owners: Array<{ login: string; type: OwnerType }>;
  repos: GitHubRepo[];
}

const DEFAULT_OWNER = 'Hardonian';
const DEFAULT_TENANT = 'public-hardonian';
const DEFAULT_ARTIFACTS_ROOT = 'artifacts';
const DEFAULT_COMMIT_LIMIT = 20;
const DEPENDENCY_FILE_NAMES = new Set([
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'go.mod',
  'Cargo.toml',
  'Cargo.lock',
]);
const README_CANDIDATES = ['README.md', 'README.MD', 'README', 'readme.md', 'Readme.md'];

export async function runIngestCommand(args: string[]): Promise<number> {
  const subcommand = args[0];
  if (subcommand !== 'lineage') {
    process.stderr.write('Usage: requiem ingest lineage --tenant <tenant_id> [options]\n');
    return 1;
  }

  let options: IngestLineageOptions;
  try {
    options = parseLineageOptions(args.slice(1));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return 1;
  }

  try {
    const result = await runLineageIngestion(options);
    process.stdout.write(`${stableJson(result.summary)}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`lineage ingest failed: ${message}\n`);
    return 1;
  }
}

function parseLineageOptions(args: string[]): IngestLineageOptions {
  let tenantId = DEFAULT_TENANT;
  let owner = DEFAULT_OWNER;
  let runId: string | undefined;
  let artifactsRoot = DEFAULT_ARTIFACTS_ROOT;
  let fetchMode: FetchMode = 'shallow';
  let discoverOrgs = true;
  let includeCommitReferences = true;
  let commitLimit = DEFAULT_COMMIT_LIMIT;
  let repoLimit: number | undefined;
  let githubToken = process.env.GITHUB_TOKEN;
  let supabaseUrl = process.env.SUPABASE_URL;
  let supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let noSupabase = false;
  let cloneRoot: string | undefined;
  let cloneTimeoutSeconds = 180;

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    switch (token) {
      case '--tenant': {
        tenantId = readRequiredValue(args, i, token);
        i += 1;
        break;
      }
      case '--owner': {
        owner = readRequiredValue(args, i, token);
        i += 1;
        break;
      }
      case '--run-id': {
        runId = readRequiredValue(args, i, token);
        i += 1;
        break;
      }
      case '--artifacts-root': {
        artifactsRoot = readRequiredValue(args, i, token);
        i += 1;
        break;
      }
      case '--fetch-mode': {
        const raw = readRequiredValue(args, i, token);
        if (raw !== 'none' && raw !== 'shallow' && raw !== 'full') {
          throw new Error(`Invalid --fetch-mode value: ${raw} (expected none|shallow|full)`);
        }
        fetchMode = raw;
        i += 1;
        break;
      }
      case '--no-discover-orgs': {
        discoverOrgs = false;
        break;
      }
      case '--discover-orgs': {
        discoverOrgs = true;
        break;
      }
      case '--no-commit-refs': {
        includeCommitReferences = false;
        break;
      }
      case '--commit-limit': {
        const raw = readRequiredValue(args, i, token);
        const parsed = Number.parseInt(raw, 10);
        if (!Number.isFinite(parsed) || parsed < 1 || parsed > 250) {
          throw new Error(`Invalid --commit-limit value: ${raw}`);
        }
        commitLimit = parsed;
        i += 1;
        break;
      }
      case '--repo-limit': {
        const raw = readRequiredValue(args, i, token);
        const parsed = Number.parseInt(raw, 10);
        if (!Number.isFinite(parsed) || parsed < 1) {
          throw new Error(`Invalid --repo-limit value: ${raw}`);
        }
        repoLimit = parsed;
        i += 1;
        break;
      }
      case '--github-token': {
        githubToken = readRequiredValue(args, i, token);
        i += 1;
        break;
      }
      case '--supabase-url': {
        supabaseUrl = readRequiredValue(args, i, token);
        i += 1;
        break;
      }
      case '--supabase-service-role-key': {
        supabaseServiceRoleKey = readRequiredValue(args, i, token);
        i += 1;
        break;
      }
      case '--no-supabase': {
        noSupabase = true;
        break;
      }
      case '--clone-root': {
        cloneRoot = readRequiredValue(args, i, token);
        i += 1;
        break;
      }
      case '--clone-timeout-seconds': {
        const raw = readRequiredValue(args, i, token);
        const parsed = Number.parseInt(raw, 10);
        if (!Number.isFinite(parsed) || parsed < 10 || parsed > 3600) {
          throw new Error(`Invalid --clone-timeout-seconds value: ${raw}`);
        }
        cloneTimeoutSeconds = parsed;
        i += 1;
        break;
      }
      default:
        throw new Error(`Unknown option for ingest lineage: ${token}`);
    }
  }

  if (!tenantId.trim()) {
    throw new Error('--tenant is required');
  }

  if (!owner.trim()) {
    throw new Error('--owner cannot be empty');
  }

  if (!noSupabase && (!supabaseUrl || !supabaseServiceRoleKey)) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (or pass --no-supabase)');
  }

  return {
    tenantId: tenantId.trim(),
    owner: owner.trim(),
    runId: runId?.trim(),
    artifactsRoot,
    fetchMode,
    discoverOrgs,
    includeCommitReferences,
    commitLimit,
    repoLimit,
    githubToken,
    supabaseUrl,
    supabaseServiceRoleKey,
    noSupabase,
    cloneRoot,
    cloneTimeoutSeconds,
  };
}

function readRequiredValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

async function runLineageIngestion(options: IngestLineageOptions): Promise<PipelineResult> {
  const startedAt = new Date();
  const runId = options.runId ?? generateRunId(startedAt);
  const artifactDir = resolve(process.cwd(), options.artifactsRoot, runId);
  mkdirSync(artifactDir, { recursive: true });

  const githubClient = new GitHubClient(options.githubToken);
  const discovery = await discoverRepositories(githubClient, options.owner, options.discoverOrgs);

  const sortedRepos = discovery.repos
    .slice()
    .sort((a, b) => normalizeRepoName(a.full_name).localeCompare(normalizeRepoName(b.full_name), 'en'));
  const selectedRepos = typeof options.repoLimit === 'number'
    ? sortedRepos.slice(0, options.repoLimit)
    : sortedRepos;

  if (selectedRepos.length === 0) {
    throw new Error(`No public repositories found for owner/profile '${options.owner}'`);
  }

  const runRecordStarted = {
    run_id: runId,
    tenant_id: options.tenantId,
    owner_login: options.owner,
    status: 'running',
    started_at: startedAt.toISOString(),
    completed_at: null,
    artifact_dir: artifactDir,
    summary: {
      owners_scanned: discovery.owners.map((owner) => owner.login),
      repos_scanned: selectedRepos.length,
    },
    manifest_hash: null,
    error_message: null,
  };

  if (!options.noSupabase && options.supabaseUrl && options.supabaseServiceRoleKey) {
    await upsertRows(options.supabaseUrl, options.supabaseServiceRoleKey, 'ingest_runs', ['run_id'], [runRecordStarted]);
  }

  const extraction = await extractEvidenceAndGraph(
    selectedRepos,
    options,
    githubClient,
    artifactDir,
    runId,
    startedAt,
  );

  const files = writeArtifacts(
    artifactDir,
    extraction.nodes,
    extraction.edges,
    extraction.evidence,
    extraction.summary,
  );

  const manifestHash = hash(stableJson(files));

  if (!options.noSupabase && options.supabaseUrl && options.supabaseServiceRoleKey) {
    await loadDatasetToSupabase(options.supabaseUrl, options.supabaseServiceRoleKey, extraction.nodes, extraction.edges, extraction.evidence);

    const runRecordCompleted = {
      run_id: runId,
      tenant_id: options.tenantId,
      owner_login: options.owner,
      status: 'success',
      started_at: startedAt.toISOString(),
      completed_at: new Date().toISOString(),
      artifact_dir: artifactDir,
      summary: extraction.summary,
      manifest_hash: manifestHash,
      error_message: null,
    };
    await upsertRows(options.supabaseUrl, options.supabaseServiceRoleKey, 'ingest_runs', ['run_id'], [runRecordCompleted]);
  }

  const summary = {
    run_id: runId,
    tenant_id: options.tenantId,
    owner: options.owner,
    owners_scanned: discovery.owners.map((owner) => owner.login).sort((a, b) => a.localeCompare(b, 'en')),
    repos_scanned: selectedRepos.length,
    nodes_count: extraction.nodes.length,
    edges_count: extraction.edges.length,
    evidence_count: extraction.evidence.length,
    fetch_mode: options.fetchMode,
    commit_limit: options.includeCommitReferences ? options.commitLimit : 0,
    repos_cloned: extraction.reposCloned,
    clone_failures: extraction.cloneFailures,
    dataset_fingerprint: extraction.summary['dataset_fingerprint'],
    artifact_dir: artifactDir,
    manifest_hash: manifestHash,
    supabase_loaded: !options.noSupabase,
  };

  return {
    runId,
    artifactDir,
    ownersScanned: discovery.owners.map((owner) => owner.login),
    reposScanned: selectedRepos.length,
    reposCloned: extraction.reposCloned,
    cloneFailures: extraction.cloneFailures,
    nodes: extraction.nodes,
    edges: extraction.edges,
    evidence: extraction.evidence,
    summary,
    files,
  };
}

async function discoverRepositories(
  githubClient: GitHubClient,
  owner: string,
  discoverOrgs: boolean,
): Promise<DiscoveryResult> {
  const profile = await githubClient.getOwner(owner);
  const owners = new Map<string, OwnerType>();
  owners.set(profile.login, profile.type);

  if (discoverOrgs && profile.type === 'User') {
    const orgs = await githubClient.listUserOrganizations(profile.login);
    for (const org of orgs) {
      owners.set(org.login, 'Organization');
    }
  }

  const ownerEntries = Array.from(owners.entries())
    .map(([login, type]) => ({ login, type }))
    .sort((a, b) => a.login.localeCompare(b.login, 'en'));

  const repoMap = new Map<string, GitHubRepo>();
  for (const currentOwner of ownerEntries) {
    const repos = currentOwner.type === 'Organization'
      ? await githubClient.listOrganizationRepositories(currentOwner.login)
      : await githubClient.listUserRepositories(currentOwner.login);

    for (const repo of repos) {
      if (repo.private) {
        continue;
      }
      const key = normalizeRepoName(repo.full_name);
      if (!repoMap.has(key)) {
        repoMap.set(key, repo);
      }
    }
  }

  return {
    owners: ownerEntries,
    repos: Array.from(repoMap.values()),
  };
}

interface ExtractionResult {
  nodes: RepoNode[];
  edges: EdgeRow[];
  evidence: EvidenceRow[];
  summary: Record<string, unknown>;
  reposCloned: number;
  cloneFailures: string[];
}

async function extractEvidenceAndGraph(
  repos: GitHubRepo[],
  options: IngestLineageOptions,
  githubClient: GitHubClient,
  artifactDir: string,
  runId: string,
  _startedAt: Date,
): Promise<ExtractionResult> {
  const nodeMap = new Map<string, RepoNode>();
  const edges = new Map<string, EdgeAccumulator>();
  const evidence = new Map<string, EvidenceRow>();
  const cloneFailures: string[] = [];
  let reposCloned = 0;

  const cloneRoot = options.cloneRoot
    ? resolve(process.cwd(), options.cloneRoot)
    : join(artifactDir, 'repos');

  if (options.fetchMode !== 'none') {
    mkdirSync(cloneRoot, { recursive: true });
  }

  const reposSorted = repos
    .slice()
    .sort((a, b) => normalizeRepoName(a.full_name).localeCompare(normalizeRepoName(b.full_name), 'en'));

  for (const repo of reposSorted) {
    const normalizedFullName = normalizeRepoName(repo.full_name);
    const owner = normalizeOwner(repo.owner.login);
    const repoName = normalizedFullName.split('/')[1] ?? '';

    nodeMap.set(normalizedFullName, {
      stable_hash: stableHash({ tenant_id: options.tenantId, repo_full_name: normalizedFullName }),
      tenant_id: options.tenantId,
      repo_full_name: normalizedFullName,
      repo_owner: owner,
      repo_name: repoName,
      is_scanned: true,
      is_fork: repo.fork,
      parent_full_name: repo.parent?.full_name ? normalizeRepoName(repo.parent.full_name) : null,
      source_full_name: repo.source?.full_name ? normalizeRepoName(repo.source.full_name) : null,
      html_url: repo.html_url,
      default_branch: repo.default_branch ?? null,
      visibility: repo.visibility ?? 'public',
      topics: (repo.topics ?? []).slice().sort((a, b) => a.localeCompare(b, 'en')),
      metadata: {
        github_id: repo.id,
        owner_type: repo.owner.type,
        stargazers_count: repo.stargazers_count ?? 0,
        forks_count: repo.forks_count ?? 0,
        archived: repo.archived ?? false,
        disabled: repo.disabled ?? false,
      },
    });

    if (repo.parent?.full_name) {
      const target = normalizeRepoName(repo.parent.full_name);
      addEvidenceRecord(options.tenantId, edges, evidence, {
        sourceRepo: normalizedFullName,
        targetRepo: target,
        edgeType: 'fork_parent',
        evidenceType: 'fork_metadata',
        evidenceValue: repo.parent.full_name,
        location: 'github:fork.parent',
        details: { repo_id: repo.id },
      });
    }

    if (repo.source?.full_name) {
      const target = normalizeRepoName(repo.source.full_name);
      addEvidenceRecord(options.tenantId, edges, evidence, {
        sourceRepo: normalizedFullName,
        targetRepo: target,
        edgeType: 'fork_source',
        evidenceType: 'fork_metadata',
        evidenceValue: repo.source.full_name,
        location: 'github:fork.source',
        details: { repo_id: repo.id },
      });
    }

    let localRepoPath: string | null = null;
    if (options.fetchMode !== 'none') {
      const clonePath = join(cloneRoot, repoPathSlug(normalizedFullName));
      const cloneResult = cloneRepository(repo, clonePath, options.fetchMode, options.cloneTimeoutSeconds);
      if (cloneResult.ok) {
        reposCloned += 1;
        localRepoPath = clonePath;
      } else {
        cloneFailures.push(`${normalizedFullName}: ${cloneResult.errorMessage}`);
      }
    }

    if (localRepoPath) {
      for (const remote of listGitRemotes(localRepoPath)) {
        const target = normalizeRepoReference(remote.url);
        if (!target) {
          continue;
        }
        addEvidenceRecord(options.tenantId, edges, evidence, {
          sourceRepo: normalizedFullName,
          targetRepo: target,
          edgeType: 'git_remote',
          evidenceType: 'git_remote',
          evidenceValue: remote.url,
          location: `git-remote:${remote.name}`,
          details: { direction: remote.direction },
        });
      }

      for (const moduleEntry of parseGitmodules(localRepoPath)) {
        const target = normalizeRepoReference(moduleEntry.url);
        if (!target) {
          continue;
        }
        addEvidenceRecord(options.tenantId, edges, evidence, {
          sourceRepo: normalizedFullName,
          targetRepo: target,
          edgeType: 'submodule',
          evidenceType: 'submodule',
          evidenceValue: moduleEntry.url,
          location: `submodule:${moduleEntry.path}`,
          details: {
            section: moduleEntry.section,
          },
        });
      }

      const dependencyMentions = extractDependencyMentions(localRepoPath);
      for (const mention of dependencyMentions) {
        addEvidenceRecord(options.tenantId, edges, evidence, {
          sourceRepo: normalizedFullName,
          targetRepo: mention.repo,
          edgeType: 'dependency',
          evidenceType: 'dependency',
          evidenceValue: mention.raw,
          location: `dependency:${mention.filePath}`,
          details: {
            extractor: mention.extractor,
          },
        });
      }

      const readmeMentions = extractReadmeMentionsFromRepo(localRepoPath);
      for (const mention of readmeMentions) {
        addEvidenceRecord(options.tenantId, edges, evidence, {
          sourceRepo: normalizedFullName,
          targetRepo: mention.repo,
          edgeType: 'readme_link',
          evidenceType: 'readme_link',
          evidenceValue: mention.raw,
          location: `readme:${mention.filePath}`,
          details: {},
        });
      }
    } else {
      const readmeContent = await githubClient.getReadmeText(normalizedFullName);
      if (readmeContent) {
        for (const mention of extractGitHubMentions(readmeContent)) {
          addEvidenceRecord(options.tenantId, edges, evidence, {
            sourceRepo: normalizedFullName,
            targetRepo: mention.repo,
            edgeType: 'readme_link',
            evidenceType: 'readme_link',
            evidenceValue: mention.raw,
            location: 'readme:github_api',
            details: {},
          });
        }
      }
    }

    if (options.includeCommitReferences) {
      const commitReferences = await githubClient.listCommitReferences(normalizedFullName, options.commitLimit);
      for (const commitReference of commitReferences) {
        const commitMentions = extractGitHubMentions(commitReference.message, true);
        for (const mention of commitMentions) {
          addEvidenceRecord(options.tenantId, edges, evidence, {
            sourceRepo: normalizedFullName,
            targetRepo: mention.repo,
            edgeType: 'commit_reference',
            evidenceType: 'commit_reference',
            evidenceValue: mention.raw,
            location: `commit:${commitReference.sha}`,
            details: {
              html_url: commitReference.htmlUrl,
            },
          });
        }
      }
    }
  }

  for (const edgeAccumulator of edges.values()) {
    if (!nodeMap.has(edgeAccumulator.edge.target_repo_full_name)) {
      const inferred = edgeAccumulator.edge.target_repo_full_name;
      const inferredParts = splitRepoName(inferred);
      nodeMap.set(inferred, {
        stable_hash: stableHash({ tenant_id: options.tenantId, repo_full_name: inferred }),
        tenant_id: options.tenantId,
        repo_full_name: inferred,
        repo_owner: inferredParts.owner,
        repo_name: inferredParts.name,
        is_scanned: false,
        is_fork: false,
        parent_full_name: null,
        source_full_name: null,
        html_url: `https://github.com/${inferred}`,
        default_branch: null,
        visibility: null,
        topics: [],
        metadata: {
          inferred: true,
        },
      });
    }
  }

  const nodesSorted = Array.from(nodeMap.values()).sort((a, b) => a.repo_full_name.localeCompare(b.repo_full_name, 'en'));
  const edgesSorted = Array.from(edges.values())
    .map((entry) => ({
      ...entry.edge,
      evidence_count: entry.evidenceHashes.size,
    }))
    .sort((a, b) => a.stable_hash.localeCompare(b.stable_hash, 'en'));
  const evidenceSorted = Array.from(evidence.values()).sort((a, b) => a.stable_hash.localeCompare(b.stable_hash, 'en'));
  const datasetFingerprint = stableHash({
    nodes: nodesSorted.map((row) => row.stable_hash),
    edges: edgesSorted.map((row) => row.stable_hash),
    evidence: evidenceSorted.map((row) => row.stable_hash),
  });

  const summary = {
    run_id: runId,
    tenant_id: options.tenantId,
    repos_scanned: repos.length,
    nodes_count: nodesSorted.length,
    edges_count: edgesSorted.length,
    evidence_count: evidenceSorted.length,
    edge_types: tallyBy(edgesSorted, (row) => row.edge_type),
    evidence_types: tallyBy(evidenceSorted, (row) => row.evidence_type),
    clone_failures: cloneFailures,
    repos_cloned: reposCloned,
    dataset_fingerprint: datasetFingerprint,
  };

  return {
    nodes: nodesSorted,
    edges: edgesSorted,
    evidence: evidenceSorted,
    summary,
    reposCloned,
    cloneFailures,
  };
}

function addEvidenceRecord(
  tenantId: string,
  edges: Map<string, EdgeAccumulator>,
  evidence: Map<string, EvidenceRow>,
  input: EvidenceInput,
): void {
  const source = normalizeRepoName(input.sourceRepo);
  const target = normalizeRepoName(input.targetRepo);
  if (!source || !target || source === target) {
    return;
  }

  const edgeStableHash = stableHash({
    tenant_id: tenantId,
    source_repo_full_name: source,
    target_repo_full_name: target,
    edge_type: input.edgeType,
  });

  const evidenceStableHash = stableHash({
    tenant_id: tenantId,
    source_repo_full_name: source,
    target_repo_full_name: target,
    edge_type: input.edgeType,
    evidence_type: input.evidenceType,
    evidence_value: trimValue(input.evidenceValue),
    location: input.location,
    details: input.details,
  });

  if (!edges.has(edgeStableHash)) {
    edges.set(edgeStableHash, {
      edge: {
        stable_hash: edgeStableHash,
        tenant_id: tenantId,
        source_repo_full_name: source,
        target_repo_full_name: target,
        edge_type: input.edgeType,
        metadata: {},
      },
      evidenceHashes: new Set<string>(),
    });
  }

  const edgeAccumulator = edges.get(edgeStableHash);
  if (edgeAccumulator) {
    edgeAccumulator.evidenceHashes.add(evidenceStableHash);
  }

  if (!evidence.has(evidenceStableHash)) {
    evidence.set(evidenceStableHash, {
      stable_hash: evidenceStableHash,
      edge_stable_hash: edgeStableHash,
      tenant_id: tenantId,
      source_repo_full_name: source,
      target_repo_full_name: target,
      evidence_type: input.evidenceType,
      evidence_value: trimValue(input.evidenceValue),
      location: input.location,
      details: input.details,
    });
  }
}

function repoPathSlug(repoFullName: string): string {
  return repoFullName.replace(/[^a-z0-9._-]/gi, '__');
}

function cloneRepository(
  repo: GitHubRepo,
  destinationPath: string,
  fetchMode: FetchMode,
  timeoutSeconds: number,
): { ok: true } | { ok: false; errorMessage: string } {
  if (existsSync(destinationPath)) {
    return { ok: true };
  }

  const args = ['clone', '--quiet', '--no-tags'];
  if (fetchMode === 'shallow') {
    args.push('--depth', '1', '--single-branch', '--branch', repo.default_branch ?? 'HEAD');
  }
  if (fetchMode === 'full') {
    args.push('--single-branch', '--branch', repo.default_branch ?? 'HEAD');
  }
  args.push(repo.clone_url, destinationPath);

  const result = spawnSync('git', args, {
    encoding: 'utf8',
    timeout: timeoutSeconds * 1000,
  });
  if (result.error) {
    return {
      ok: false,
      errorMessage: result.error.message,
    };
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ?? 'unknown git clone error';
    return {
      ok: false,
      errorMessage: stderr,
    };
  }

  return { ok: true };
}

interface GitRemote {
  name: string;
  url: string;
  direction: 'fetch' | 'push';
}

function listGitRemotes(repoPath: string): GitRemote[] {
  const result = spawnSync('git', ['-C', repoPath, 'remote', '-v'], { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout) {
    return [];
  }

  const remotes: GitRemote[] = [];
  const seen = new Set<string>();

  for (const line of result.stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const match = trimmed.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
    if (!match) {
      continue;
    }

    const remote: GitRemote = {
      name: match[1] ?? '',
      url: match[2] ?? '',
      direction: (match[3] ?? 'fetch') as 'fetch' | 'push',
    };

    const key = `${remote.name}|${remote.url}|${remote.direction}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    remotes.push(remote);
  }

  return remotes.sort((a, b) => {
    const left = `${a.name}:${a.direction}:${a.url}`;
    const right = `${b.name}:${b.direction}:${b.url}`;
    return left.localeCompare(right, 'en');
  });
}

interface SubmoduleEntry {
  section: string;
  path: string;
  url: string;
}

function parseGitmodules(repoPath: string): SubmoduleEntry[] {
  const filePath = join(repoPath, '.gitmodules');
  if (!existsSync(filePath)) {
    return [];
  }

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  const entries: SubmoduleEntry[] = [];
  let currentSection = '';
  let currentPath = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed.startsWith('[submodule')) {
      currentSection = trimmed;
      currentPath = '';
      continue;
    }
    if (trimmed.startsWith('path')) {
      const parts = trimmed.split('=');
      currentPath = (parts[1] ?? '').trim();
      continue;
    }
    if (trimmed.startsWith('url')) {
      const parts = trimmed.split('=');
      const url = (parts[1] ?? '').trim();
      if (url) {
        entries.push({
          section: currentSection,
          path: currentPath,
          url,
        });
      }
    }
  }

  return entries.sort((a, b) => `${a.path}:${a.url}`.localeCompare(`${b.path}:${b.url}`, 'en'));
}

interface Mention {
  repo: string;
  raw: string;
}

interface DependencyMention extends Mention {
  filePath: string;
  extractor: string;
}

function extractDependencyMentions(repoPath: string): DependencyMention[] {
  const trackedFiles = listTrackedFiles(repoPath);
  const matches: DependencyMention[] = [];
  const seen = new Set<string>();

  for (const relativePath of trackedFiles) {
    const fileName = basename(relativePath);
    if (!DEPENDENCY_FILE_NAMES.has(fileName)) {
      continue;
    }

    const absolutePath = join(repoPath, relativePath);
    if (!existsSync(absolutePath)) {
      continue;
    }

    const stats = statSync(absolutePath);
    if (stats.size > 5 * 1024 * 1024) {
      continue;
    }

    const content = readFileSync(absolutePath, 'utf8');
    const mentions = fileName === 'package.json'
      ? extractPackageJsonDependencyMentions(content)
      : extractGitHubMentions(content);

    for (const mention of mentions) {
      const normalized = normalizeRepoName(mention.repo);
      if (!normalized) {
        continue;
      }
      const key = `${relativePath}|${normalized}|${mention.raw}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      matches.push({
        repo: normalized,
        raw: mention.raw,
        filePath: relativePath,
        extractor: fileName,
      });
    }
  }

  return matches.sort((a, b) => {
    const left = `${a.filePath}:${a.repo}:${a.raw}`;
    const right = `${b.filePath}:${b.repo}:${b.raw}`;
    return left.localeCompare(right, 'en');
  });
}

function listTrackedFiles(repoPath: string): string[] {
  const result = spawnSync('git', ['-C', repoPath, 'ls-files'], { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout) {
    return [];
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .sort((a, b) => a.localeCompare(b, 'en'));
}

function extractPackageJsonDependencyMentions(content: string): Mention[] {
  const result: Mention[] = [];
  const seen = new Set<string>();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return result;
  }

  const dependencyBuckets = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
    'overrides',
    'resolutions',
  ];

  for (const bucket of dependencyBuckets) {
    const rawBucket = parsed[bucket];
    if (!rawBucket || typeof rawBucket !== 'object' || Array.isArray(rawBucket)) {
      continue;
    }

    for (const [dependencyName, rawSpec] of Object.entries(rawBucket)) {
      if (typeof rawSpec !== 'string') {
        continue;
      }
      const spec = rawSpec.trim();
      const mentions = extractGitHubMentions(spec);
      for (const mention of mentions) {
        const key = `${mention.repo}:${dependencyName}:${mention.raw}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        result.push({
          repo: mention.repo,
          raw: `${dependencyName}@${trimValue(mention.raw)}`,
        });
      }

      const shorthand = extractShorthandRepoFromDependencySpec(spec);
      if (shorthand) {
        const key = `${shorthand}:${dependencyName}:${spec}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({
            repo: shorthand,
            raw: `${dependencyName}@${trimValue(spec)}`,
          });
        }
      }
    }
  }

  return result;
}

function extractShorthandRepoFromDependencySpec(spec: string): string | null {
  const cleaned = spec.replace(/^github:/i, '').replace(/^git\+/, '').trim();
  const directMatch = cleaned.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:#.+)?$/);
  if (!directMatch) {
    return null;
  }

  const owner = directMatch[1] ?? '';
  const repo = (directMatch[2] ?? '').replace(/\.git$/i, '');
  if (!owner || !repo || owner.startsWith('@')) {
    return null;
  }
  return normalizeRepoName(`${owner}/${repo}`);
}

function extractReadmeMentionsFromRepo(repoPath: string): Array<Mention & { filePath: string }> {
  for (const candidate of README_CANDIDATES) {
    const filePath = join(repoPath, candidate);
    if (!existsSync(filePath)) {
      continue;
    }
    const content = readFileSync(filePath, 'utf8');
    return extractGitHubMentions(content).map((mention) => ({
      ...mention,
      filePath: candidate,
    }));
  }

  const topLevelFiles = readdirSync(repoPath).sort((a, b) => a.localeCompare(b, 'en'));
  for (const fileName of topLevelFiles) {
    if (!/^readme/i.test(fileName)) {
      continue;
    }
    const filePath = join(repoPath, fileName);
    if (!statSync(filePath).isFile()) {
      continue;
    }
    const content = readFileSync(filePath, 'utf8');
    return extractGitHubMentions(content).map((mention) => ({
      ...mention,
      filePath: fileName,
    }));
  }

  return [];
}

function extractGitHubMentions(text: string, includeIssueStyle = false): Mention[] {
  const mentions: Mention[] = [];
  const seen = new Set<string>();

  const pushMention = (owner: string, repo: string, raw: string): void => {
    const normalized = normalizeRepoName(`${owner}/${repo}`);
    if (!normalized) {
      return;
    }
    const key = `${normalized}|${raw}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    mentions.push({
      repo: normalized,
      raw: trimValue(raw),
    });
  };

  const urlPattern = /(?:https?:\/\/|git\+https?:\/\/|ssh:\/\/git@|git@)github\.com[/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?(?:[/?#][^\s"')\]]*)?/gi;
  let urlMatch: RegExpExecArray | null = urlPattern.exec(text);
  while (urlMatch) {
    const owner = urlMatch[1] ?? '';
    const repo = (urlMatch[2] ?? '').replace(/\.git$/i, '');
    pushMention(owner, repo, urlMatch[0] ?? `${owner}/${repo}`);
    urlMatch = urlPattern.exec(text);
  }

  const githubPrefixPattern = /\bgithub:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\b/gi;
  let prefixMatch: RegExpExecArray | null = githubPrefixPattern.exec(text);
  while (prefixMatch) {
    const owner = prefixMatch[1] ?? '';
    const repo = (prefixMatch[2] ?? '').replace(/\.git$/i, '');
    pushMention(owner, repo, prefixMatch[0] ?? `${owner}/${repo}`);
    prefixMatch = githubPrefixPattern.exec(text);
  }

  if (includeIssueStyle) {
    const issuePattern = /\b([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)#\d+\b/g;
    let issueMatch: RegExpExecArray | null = issuePattern.exec(text);
    while (issueMatch) {
      const owner = issueMatch[1] ?? '';
      const repo = (issueMatch[2] ?? '').replace(/\.git$/i, '');
      pushMention(owner, repo, issueMatch[0] ?? `${owner}/${repo}`);
      issueMatch = issuePattern.exec(text);
    }
  }

  return mentions.sort((a, b) => `${a.repo}:${a.raw}`.localeCompare(`${b.repo}:${b.raw}`, 'en'));
}

function normalizeRepoReference(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const direct = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:#.+)?$/);
  if (direct) {
    return normalizeRepoName(`${direct[1]}/${direct[2]}`);
  }

  const urlPattern = /(?:https?:\/\/|git\+https?:\/\/|ssh:\/\/git@|git@)github\.com[/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?(?:[/?#].*)?$/i;
  const match = trimmed.match(urlPattern);
  if (!match) {
    return null;
  }

  const owner = match[1] ?? '';
  const repo = (match[2] ?? '').replace(/\.git$/i, '');
  return normalizeRepoName(`${owner}/${repo}`);
}

function normalizeRepoName(repoFullName: string): string {
  const trimmed = repoFullName.trim();
  const parts = trimmed.split('/').filter((part) => part.length > 0);
  if (parts.length < 2) {
    return '';
  }
  const owner = normalizeOwner(parts[0] ?? '');
  const repo = (parts[1] ?? '').toLowerCase();
  if (!owner || !repo) {
    return '';
  }
  return `${owner}/${repo}`;
}

function normalizeOwner(owner: string): string {
  return owner.trim().toLowerCase();
}

function splitRepoName(repoFullName: string): { owner: string; name: string } {
  const normalized = normalizeRepoName(repoFullName);
  const parts = normalized.split('/');
  return {
    owner: parts[0] ?? '',
    name: parts[1] ?? '',
  };
}

function trimValue(value: string): string {
  if (value.length <= 512) {
    return value;
  }
  return `${value.slice(0, 509)}...`;
}

function tallyBy<T>(rows: T[], getKey: (row: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = getKey(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b, 'en')));
}

function writeArtifacts(
  artifactDir: string,
  nodes: RepoNode[],
  edges: EdgeRow[],
  evidence: EvidenceRow[],
  summary: Record<string, unknown>,
): Array<{ path: string; bytes: number; sha: string }> {
  const nodesPath = join(artifactDir, 'nodes.csv');
  const edgesPath = join(artifactDir, 'edges.csv');
  const evidencePath = join(artifactDir, 'evidence.jsonl');
  const summaryPath = join(artifactDir, 'summary.json');

  writeFileSync(nodesPath, renderNodesCsv(nodes), 'utf8');
  writeFileSync(edgesPath, renderEdgesCsv(edges), 'utf8');
  writeFileSync(evidencePath, renderEvidenceJsonl(evidence), 'utf8');
  writeFileSync(summaryPath, `${stableJson(summary)}\n`, 'utf8');

  const files = [nodesPath, edgesPath, evidencePath, summaryPath]
    .map((filePath) => {
      const content = readFileSync(filePath);
      return {
        path: filePath,
        bytes: content.byteLength,
        sha: hash(content),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path, 'en'));

  const manifestJsonPath = join(artifactDir, 'manifest.json');
  const manifestFilesJsonlPath = join(artifactDir, 'manifest.files.jsonl');

  writeFileSync(
    manifestJsonPath,
    `${stableJson({
      generated_at: new Date().toISOString(),
      files,
    })}\n`,
    'utf8',
  );

  writeFileSync(
    manifestFilesJsonlPath,
    `${files.map((file) => stableJson(file)).join('\n')}\n`,
    'utf8',
  );

  const withManifest = [
    ...files,
    {
      path: manifestJsonPath,
      bytes: readFileSync(manifestJsonPath).byteLength,
      sha: hash(readFileSync(manifestJsonPath)),
    },
    {
      path: manifestFilesJsonlPath,
      bytes: readFileSync(manifestFilesJsonlPath).byteLength,
      sha: hash(readFileSync(manifestFilesJsonlPath)),
    },
  ].sort((a, b) => a.path.localeCompare(b.path, 'en'));

  return withManifest;
}

function renderNodesCsv(nodes: RepoNode[]): string {
  const headers = [
    'stable_hash',
    'tenant_id',
    'repo_full_name',
    'repo_owner',
    'repo_name',
    'is_scanned',
    'is_fork',
    'parent_full_name',
    'source_full_name',
    'html_url',
    'default_branch',
    'visibility',
    'topics_json',
    'metadata_json',
  ];

  const lines = [headers.join(',')];
  for (const node of nodes) {
    lines.push([
      csvValue(node.stable_hash),
      csvValue(node.tenant_id),
      csvValue(node.repo_full_name),
      csvValue(node.repo_owner),
      csvValue(node.repo_name),
      csvValue(node.is_scanned),
      csvValue(node.is_fork),
      csvValue(node.parent_full_name),
      csvValue(node.source_full_name),
      csvValue(node.html_url),
      csvValue(node.default_branch),
      csvValue(node.visibility),
      csvValue(stableJson(node.topics)),
      csvValue(stableJson(node.metadata)),
    ].join(','));
  }

  return `${lines.join('\n')}\n`;
}

function renderEdgesCsv(edges: EdgeRow[]): string {
  const headers = [
    'stable_hash',
    'tenant_id',
    'source_repo_full_name',
    'target_repo_full_name',
    'edge_type',
    'evidence_count',
    'metadata_json',
  ];

  const lines = [headers.join(',')];
  for (const edge of edges) {
    lines.push([
      csvValue(edge.stable_hash),
      csvValue(edge.tenant_id),
      csvValue(edge.source_repo_full_name),
      csvValue(edge.target_repo_full_name),
      csvValue(edge.edge_type),
      csvValue(edge.evidence_count),
      csvValue(stableJson(edge.metadata)),
    ].join(','));
  }

  return `${lines.join('\n')}\n`;
}

function renderEvidenceJsonl(rows: EvidenceRow[]): string {
  return `${rows.map((row) => stableJson(row)).join('\n')}\n`;
}

function csvValue(value: string | number | boolean | null): string {
  if (value === null) {
    return '""';
  }
  const serialized = String(value).replace(/"/g, '""');
  return `"${serialized}"`;
}

async function loadDatasetToSupabase(
  supabaseUrl: string,
  supabaseServiceRoleKey: string,
  nodes: RepoNode[],
  edges: EdgeRow[],
  evidence: EvidenceRow[],
): Promise<void> {
  const repoRows = nodes.map((node) => ({
    stable_hash: node.stable_hash,
    tenant_id: node.tenant_id,
    repo_full_name: node.repo_full_name,
    repo_owner: node.repo_owner,
    repo_name: node.repo_name,
    is_scanned: node.is_scanned,
    is_fork: node.is_fork,
    parent_full_name: node.parent_full_name,
    source_full_name: node.source_full_name,
    html_url: node.html_url,
    default_branch: node.default_branch,
    visibility: node.visibility,
    topics: node.topics,
    metadata: node.metadata,
    updated_at: new Date().toISOString(),
  }));

  const edgeRows = edges.map((edge) => ({
    stable_hash: edge.stable_hash,
    tenant_id: edge.tenant_id,
    source_repo_full_name: edge.source_repo_full_name,
    target_repo_full_name: edge.target_repo_full_name,
    edge_type: edge.edge_type,
    evidence_count: edge.evidence_count,
    metadata: edge.metadata,
    updated_at: new Date().toISOString(),
  }));

  const evidenceRows = evidence.map((row) => ({
    stable_hash: row.stable_hash,
    edge_stable_hash: row.edge_stable_hash,
    tenant_id: row.tenant_id,
    source_repo_full_name: row.source_repo_full_name,
    target_repo_full_name: row.target_repo_full_name,
    evidence_type: row.evidence_type,
    evidence_value: row.evidence_value,
    location: row.location,
    details: row.details,
  }));

  await upsertRows(supabaseUrl, supabaseServiceRoleKey, 'repos', ['stable_hash'], repoRows);
  await upsertRows(supabaseUrl, supabaseServiceRoleKey, 'edges', ['stable_hash'], edgeRows);
  await upsertRows(supabaseUrl, supabaseServiceRoleKey, 'evidence', ['stable_hash'], evidenceRows);
}

async function upsertRows(
  supabaseUrl: string,
  serviceRoleKey: string,
  table: string,
  conflictColumns: string[],
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const batchSize = 250;
  for (let start = 0; start < rows.length; start += batchSize) {
    const chunk = rows.slice(start, start + batchSize);
    const url = new URL(`/rest/v1/${table}`, supabaseUrl);
    url.searchParams.set('on_conflict', conflictColumns.join(','));

    const response = await requestText('POST', url.toString(), {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=minimal',
    }, stableJson(chunk));

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`Supabase upsert failed for table '${table}' (HTTP ${response.statusCode}): ${response.body}`);
    }
  }
}

function stableHash(value: unknown): string {
  return hash(stableJson(value));
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sortDeep(entry));
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right, 'en'));

    const sortedObject: Record<string, unknown> = {};
    for (const [key, entryValue] of entries) {
      sortedObject[key] = sortDeep(entryValue);
    }
    return sortedObject;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Non-finite number in stable JSON payload');
    }
    if (Object.is(value, -0)) {
      return 0;
    }
  }
  return value;
}

function generateRunId(startedAt: Date): string {
  const iso = startedAt.toISOString();
  const compact = iso.replace(/[-:.TZ]/g, '');
  return `lineage-${compact.slice(0, 14)}`;
}

class GitHubClient {
  private readonly token?: string;

  constructor(token?: string) {
    this.token = token;
  }

  async getOwner(login: string): Promise<GitHubOwner> {
    const response = await this.requestJson<GitHubOwner>(`/users/${encodeURIComponent(login)}`);
    return {
      login: response.login,
      type: response.type,
    };
  }

  async listUserOrganizations(login: string): Promise<GitHubOrg[]> {
    return this.paginate<GitHubOrg>(`/users/${encodeURIComponent(login)}/orgs?per_page=100`);
  }

  async listUserRepositories(login: string): Promise<GitHubRepo[]> {
    return this.paginate<GitHubRepo>(`/users/${encodeURIComponent(login)}/repos?type=public&sort=full_name&direction=asc&per_page=100`);
  }

  async listOrganizationRepositories(login: string): Promise<GitHubRepo[]> {
    return this.paginate<GitHubRepo>(`/orgs/${encodeURIComponent(login)}/repos?type=public&sort=full_name&direction=asc&per_page=100`);
  }

  async listCommitReferences(repoFullName: string, limit: number): Promise<Array<{ sha: string; message: string; htmlUrl: string }>> {
    if (limit <= 0) {
      return [];
    }

    const url = `/repos/${repoFullName}/commits?per_page=${Math.min(limit, 100)}`;
    const response = await this.request(url, {
      accept: 'application/vnd.github+json',
    });

    if (response.statusCode === 409) {
      return [];
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`GitHub commit request failed for ${repoFullName} (HTTP ${response.statusCode}): ${response.body}`);
    }

    const commits = JSON.parse(response.body) as GitHubCommit[];
    return commits
      .slice(0, limit)
      .map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        htmlUrl: commit.html_url,
      }));
  }

  async getReadmeText(repoFullName: string): Promise<string | null> {
    const response = await this.request(`/repos/${repoFullName}/readme`, {
      accept: 'application/vnd.github.raw',
    });

    if (response.statusCode === 404) {
      return null;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`GitHub README request failed for ${repoFullName} (HTTP ${response.statusCode}): ${response.body}`);
    }

    return response.body;
  }

  private async paginate<T>(path: string): Promise<T[]> {
    let nextUrl: string | null = new URL(path, 'https://api.github.com').toString();
    const allItems: T[] = [];

    while (nextUrl) {
      const response = await this.request(nextUrl, {
        accept: 'application/vnd.github+json',
      });

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(`GitHub pagination failed (HTTP ${response.statusCode}) at ${nextUrl}: ${response.body}`);
      }

      const parsed = JSON.parse(response.body) as T[];
      for (const item of parsed) {
        allItems.push(item);
      }

      nextUrl = parseNextLink(response.headers.link);
    }

    return allItems;
  }

  private async requestJson<T>(path: string): Promise<T> {
    const response = await this.request(path, {
      accept: 'application/vnd.github+json',
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`GitHub request failed (HTTP ${response.statusCode}) for ${path}: ${response.body}`);
    }

    return JSON.parse(response.body) as T;
  }

  private async request(pathOrUrl: string, extraHeaders: Record<string, string>): Promise<HttpResponse> {
    const url = pathOrUrl.startsWith('http')
      ? pathOrUrl
      : new URL(pathOrUrl, 'https://api.github.com').toString();

    const headers: Record<string, string> = {
      accept: 'application/vnd.github+json',
      'user-agent': 'requiem-lineage-ingest',
      ...extraHeaders,
    };

    if (this.token) {
      headers.authorization = `Bearer ${this.token}`;
    }

    return requestText('GET', url, headers);
  }
}

function parseNextLink(linkHeader: string | string[] | undefined): string | null {
  if (!linkHeader) {
    return null;
  }

  const header = Array.isArray(linkHeader) ? linkHeader.join(',') : linkHeader;
  const parts = header.split(',').map((part) => part.trim());
  for (const part of parts) {
    const match = part.match(/^<([^>]+)>;\s*rel="([^"]+)"$/);
    if (!match) {
      continue;
    }
    if (match[2] === 'next') {
      return match[1] ?? null;
    }
  }

  return null;
}

function requestText(
  method: 'GET' | 'POST',
  urlString: string,
  headers: Record<string, string>,
  body?: string,
): Promise<HttpResponse> {
  const url = new URL(urlString);

  return new Promise<HttpResponse>((resolvePromise, rejectPromise) => {
    const req = httpsRequest(
      {
        method,
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        port: url.port || undefined,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolvePromise({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body: text,
          });
        });
      },
    );

    req.on('error', (error) => {
      rejectPromise(error);
    });

    if (body) {
      req.write(body);
    }

    req.end();
  });
}
