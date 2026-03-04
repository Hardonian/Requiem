import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { getPathConfigFromEnv } from './paths.js';
import * as io from './io.js';

export interface RuntimeFingerprint {
  git_commit: string;
  invariants_spec_version: string;
  policy_bundle_cas: string;
  config_cas: string;
  replica_mode: string;
  capabilities_mode: string;
  intents_mode: string;
  determinism_mode: string;
  generated_at: string;
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function canonical(value: unknown): string {
  const normalize = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(normalize);
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([, val]) => val !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => [key, normalize(val)]),
    );
  };
  return JSON.stringify(normalize(value));
}

function readTextIfExists(filePath: string): string {
  return io.fileExists(filePath) ? io.readTextFile(filePath) : '';
}

function getGitCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function getInvariantsSpecVersion(): string {
  const determinismSpec = readTextIfExists(path.join(process.cwd(), 'docs', 'DETERMINISM.md'));
  if (!determinismSpec) return 'missing';
  return `sha256:${sha256Hex(determinismSpec).slice(0, 16)}`;
}

function getPolicyBundleCAS(): string {
  const policyDir = path.join(process.cwd(), 'policy');
  const contractDir = path.join(process.cwd(), 'contracts');

  const records: Array<{ file: string; hash: string }> = [];
  for (const dir of [policyDir, contractDir]) {
    if (!io.fileExists(dir) || !io.isDirectory(dir)) continue;
    let files: string[] = [];
    try {
      files = execSync(`rg --files ${dir}`, { encoding: 'utf8' })
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean)
        .sort();
    } catch {
      files = [];
    }
    for (const file of files) {
      records.push({ file: path.relative(process.cwd(), file), hash: sha256Hex(io.readTextFile(file)) });
    }
  }
  return sha256Hex(canonical(records));
}

function loadConfigSnapshot(): Record<string, unknown> {
  const envSnapshot = {
    REQUIEM_REPLICA_MODE: process.env.REQUIEM_REPLICA_MODE ?? 'standalone',
    REQUIEM_CAPABILITIES_MODE: process.env.REQUIEM_CAPABILITIES_MODE ?? 'default',
    REQUIEM_INTENTS_MODE: process.env.REQUIEM_INTENTS_MODE ?? 'default',
    REQUIEM_DETERMINISM_MODE: process.env.REQUIEM_DETERMINISM_MODE ?? 'strict',
    REQUIEM_PROOF_PACKS: process.env.REQUIEM_PROOF_PACKS ?? '',
    REQUIEM_SIMULATION_ENABLED: process.env.REQUIEM_SIMULATION_ENABLED ?? 'false',
  };

  const configFile = path.join(process.env.HOME || '', '.requiem', 'config.json');
  const localConfig = io.readJsonFile<Record<string, unknown>>(configFile) ?? {};

  return { env: envSnapshot, config: localConfig };
}

export function createRuntimeFingerprint(): RuntimeFingerprint {
  const configSnapshot = loadConfigSnapshot();

  return {
    git_commit: getGitCommit(),
    invariants_spec_version: getInvariantsSpecVersion(),
    policy_bundle_cas: getPolicyBundleCAS(),
    config_cas: sha256Hex(canonical(configSnapshot)),
    replica_mode: String((configSnapshot.env as Record<string, unknown>).REQUIEM_REPLICA_MODE),
    capabilities_mode: String((configSnapshot.env as Record<string, unknown>).REQUIEM_CAPABILITIES_MODE),
    intents_mode: String((configSnapshot.env as Record<string, unknown>).REQUIEM_INTENTS_MODE),
    determinism_mode: String((configSnapshot.env as Record<string, unknown>).REQUIEM_DETERMINISM_MODE),
    generated_at: new Date().toISOString(),
  };
}

export function persistFingerprintToCAS(fingerprint: RuntimeFingerprint): { digest: string; objectPath: string } {
  const casDir = getPathConfigFromEnv().casDir;
  const objectsDir = path.join(casDir, 'objects');
  io.ensureDir(objectsDir);

  const payload = canonical(fingerprint);
  const digest = sha256Hex(payload);
  const objectDir = path.join(objectsDir, digest.slice(0, 2));
  const objectPath = path.join(objectDir, digest);
  io.ensureDir(objectDir);

  if (!io.fileExists(objectPath)) {
    io.writeTextFile(objectPath, payload);
    io.writeJsonFile(`${objectPath}.meta`, {
      type: 'runtime_fingerprint',
      digest,
      created_at: new Date().toISOString(),
    });
  }

  const refsDir = path.join(casDir, 'refs');
  io.ensureDir(refsDir);
  io.writeJsonFile(path.join(refsDir, 'runtime-fingerprint.latest.json'), {
    digest,
    updated_at: new Date().toISOString(),
  });

  return { digest, objectPath };
}

export function getLatestFingerprintCAS(): string | null {
  const casDir = getPathConfigFromEnv().casDir;
  const latestRef = path.join(casDir, 'refs', 'runtime-fingerprint.latest.json');
  const value = io.readJsonFile<{ digest?: string }>(latestRef);
  return value?.digest ?? null;
}
