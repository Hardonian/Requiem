import { createHash, createPrivateKey, createPublicKey, sign as edSign, verify as edVerify } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

interface ProofpackEnvelope {
  manifest?: Record<string, unknown>;
  signatures?: {
    algorithm: string;
    key_id: string;
    signature: string;
    signed_at: string;
  }[];
  [key: string]: unknown;
}

const REQUIRED_PROOFPACK_FIELDS = [
  'execution_id',
  'input_hash',
  'workflow_hash',
  'policy_hash',
  'state_hash',
  'timestamp_iso',
  'signature',
] as const;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}

function readJson(filePath: string): ProofpackEnvelope {
  return JSON.parse(readFileSync(filePath, 'utf-8')) as ProofpackEnvelope;
}

function resolveManifest(pack: ProofpackEnvelope): Record<string, unknown> {
  const manifest = (pack.manifest ?? pack) as Record<string, unknown>;
  return manifest;
}

function digestManifest(manifest: Record<string, unknown>): string {
  return createHash('sha256').update(stableStringify(manifest)).digest('hex');
}

function getValue(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

export async function runProofInspectCommand(args: string[], json: boolean): Promise<number> {
  const proofpackPath = args.find(a => !a.startsWith('--'));
  if (!proofpackPath) {
    process.stderr.write('Usage: requiem proof:inspect <proofpack> [--json]\n');
    return 1;
  }
  if (!existsSync(proofpackPath)) {
    process.stderr.write(`Error: proofpack not found: ${proofpackPath}\n`);
    return 1;
  }

  const pack = readJson(proofpackPath);
  const manifest = resolveManifest(pack);
  const missingFields = REQUIRED_PROOFPACK_FIELDS.filter(field => !getValue(manifest, field));
  const toolHashes = (manifest.tool_call_hashes ?? manifest.adapter_responses ?? []) as unknown[];
  const digest = digestManifest(manifest);

  const report = {
    file: proofpackPath,
    execution_id: getValue(manifest, 'execution_id'),
    input_hash: getValue(manifest, 'input_hash'),
    workflow_hash: getValue(manifest, 'workflow_hash'),
    policy_hash: getValue(manifest, 'policy_hash'),
    state_hash: getValue(manifest, 'state_hash'),
    timestamp: getValue(manifest, 'timestamp_iso') || getValue(manifest, 'timestamp'),
    signature_present: getValue(manifest, 'signature').length > 0 || Array.isArray(pack.signatures),
    adapter_response_count: Array.isArray(toolHashes) ? toolHashes.length : 0,
    manifest_digest_sha256: digest,
    required_fields_ok: missingFields.length === 0,
    missing_fields: missingFields,
  };

  if (json) {
    process.stdout.write(JSON.stringify(report) + '\n');
    return missingFields.length === 0 ? 0 : 2;
  }

  process.stdout.write(`Proofpack: ${report.file}\n`);
  process.stdout.write(`Execution ID: ${report.execution_id || '<missing>'}\n`);
  process.stdout.write(`Manifest digest (sha256): ${report.manifest_digest_sha256}\n`);
  process.stdout.write(`Adapter responses: ${report.adapter_response_count}\n`);
  process.stdout.write(`Required fields: ${report.required_fields_ok ? 'ok' : 'missing'}\n`);
  if (missingFields.length > 0) {
    process.stdout.write(`Missing fields: ${missingFields.join(', ')}\n`);
  }
  return missingFields.length === 0 ? 0 : 2;
}

function getFlagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

export async function runProofSignCommand(args: string[], json: boolean): Promise<number> {
  const proofpackPath = args.find(a => !a.startsWith('--'));
  const keyPath = getFlagValue(args, '--key');
  if (!proofpackPath || !keyPath) {
    process.stderr.write('Usage: requiem proof:sign <proofpack> --key <private-key.pem> [--json]\n');
    return 1;
  }
  if (!existsSync(proofpackPath) || !existsSync(keyPath)) {
    process.stderr.write('Error: proofpack or key file does not exist\n');
    return 1;
  }

  const pack = readJson(proofpackPath);
  const manifest = resolveManifest(pack);
  const digest = digestManifest(manifest);
  const privateKey = createPrivateKey(readFileSync(keyPath, 'utf-8'));
  const signature = edSign(null, Buffer.from(digest, 'utf-8'), privateKey).toString('base64');

  const existing = Array.isArray(pack.signatures) ? pack.signatures : [];
  pack.signatures = [
    ...existing,
    {
      algorithm: 'ed25519-sha256-manifest',
      key_id: createHash('sha256').update(readFileSync(keyPath, 'utf-8')).digest('hex').slice(0, 16),
      signature,
      signed_at: new Date().toISOString(),
    },
  ];

  writeFileSync(proofpackPath, JSON.stringify(pack, null, 2) + '\n', 'utf-8');

  const output = { signed: true, proofpack: proofpackPath, manifest_digest_sha256: digest, signatures: pack.signatures.length };
  process.stdout.write((json ? JSON.stringify(output) : `Signed ${proofpackPath} (digest=${digest})\n`) + '\n');
  return 0;
}

export async function runProofVerifyCommand(args: string[], json: boolean): Promise<number> {
  const proofpackPath = args.find(a => !a.startsWith('--'));
  const keyPath = getFlagValue(args, '--key');
  if (!proofpackPath || !keyPath) {
    process.stderr.write('Usage: requiem proof:verify <proofpack> --key <public-key.pem> [--json]\n');
    return 1;
  }
  if (!existsSync(proofpackPath) || !existsSync(keyPath)) {
    process.stderr.write('Error: proofpack or key file does not exist\n');
    return 1;
  }

  const pack = readJson(proofpackPath);
  const signatures = Array.isArray(pack.signatures) ? pack.signatures : [];
  if (signatures.length === 0) {
    process.stderr.write('Error: proofpack has no attached signatures\n');
    return 2;
  }

  const manifest = resolveManifest(pack);
  const digest = digestManifest(manifest);
  const publicKey = createPublicKey(readFileSync(keyPath, 'utf-8'));
  const checks = signatures.map(sig => ({
    key_id: sig.key_id,
    valid: edVerify(null, Buffer.from(digest, 'utf-8'), publicKey, Buffer.from(sig.signature, 'base64')),
  }));

  const valid = checks.some(c => c.valid);
  const payload = { valid, proofpack: proofpackPath, manifest_digest_sha256: digest, checks };
  process.stdout.write((json ? JSON.stringify(payload) : `Verification: ${valid ? 'VALID' : 'INVALID'}\n`) + '\n');
  return valid ? 0 : 2;
}

interface PackageDependencySet {
  name: string;
  version: string;
  path: string;
  dependencies: Record<string, string>;
}

function collectPackageJsons(rootDir: string): PackageDependencySet[] {
  const candidateFiles = [
    join(rootDir, 'package.json'),
    join(rootDir, 'ready-layer', 'package.json'),
    join(rootDir, 'packages', 'cli', 'package.json'),
    join(rootDir, 'packages', 'web', 'package.json'),
    join(rootDir, 'packages', 'core', 'package.json'),
  ];

  const results: PackageDependencySet[] = [];
  for (const full of candidateFiles) {
    if (!existsSync(full)) continue;
    const data = JSON.parse(readFileSync(full, 'utf-8')) as Record<string, unknown>;
    results.push({
      name: String(data.name ?? full),
      version: String(data.version ?? '0.0.0'),
      path: full,
      dependencies: {
        ...((data.dependencies ?? {}) as Record<string, string>),
        ...((data.devDependencies ?? {}) as Record<string, string>),
      },
    });
  }

  return results;
}

export async function runSecurityScanCommand(args: string[], json: boolean): Promise<number> {
  const cwd = process.cwd();
  const outPath = getFlagValue(args, '--sbom') ?? join(cwd, 'artifacts', 'sbom', 'sbom.json');
  const denyList = new Set(['event-stream', 'ua-parser-js@0.7.29']);
  const packageJsons = collectPackageJsons(cwd);
  const findings: Array<{ package: string; version: string; severity: 'high'; reason: string; source: string }> = [];
  const components: Array<{ name: string; version: string; source: string }> = [];

  for (const pkg of packageJsons) {
    components.push({ name: pkg.name, version: pkg.version, source: pkg.path });
    for (const [dep, version] of Object.entries(pkg.dependencies)) {
      const normalized = `${dep}@${version.replace(/^[^0-9]*/, '')}`;
      if (denyList.has(dep) || denyList.has(normalized)) {
        findings.push({ package: dep, version, severity: 'high', reason: 'denylist match', source: pkg.path });
      }
    }
  }

  const sbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${createHash('sha256').update(String(Date.now())).digest('hex').slice(0, 32)}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [{ vendor: 'Requiem', name: 'requiem security:scan', version: '0.1.0' }],
    },
    components,
    findings,
    status: findings.length === 0 ? 'clean' : 'degraded',
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(sbom, null, 2) + '\n', 'utf-8');

  if (json) {
    process.stdout.write(JSON.stringify({ status: sbom.status, findings: findings.length, sbom: outPath }) + '\n');
  } else {
    process.stdout.write(`Security scan status: ${sbom.status}\nFindings: ${findings.length}\nSBOM: ${outPath}\n`);
  }

  return findings.length === 0 ? 0 : 2;
}
