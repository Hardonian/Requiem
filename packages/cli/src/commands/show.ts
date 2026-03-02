#!/usr/bin/env node
/**
 * @fileoverview Show command - Inspect run, artifact, or manifest details.
 *
 * Supports:
 * - run: Show detailed run information
 * - artifact: Show artifact metadata and contents
 * - manifest: Show execution manifest
 *
 * Output formats: --json, --yaml, --table
 */

import { Command } from 'commander';
import { join } from 'path';
import { existsSync, readFileSync, statSync } from 'fs';

interface RunDetails {
  id: string;
  fingerprint: string;
  tool: string;
  timestamp: string;
  status: string;
  duration:?: unknown;
  output?: unknown;
  error?: string;
  input?: string;
  trace?: unknown;
  policyResults?: unknown[];
}

interface ArtifactDetails {
  id: string;
  type: string;
  size: number;
  checksum: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
  contents?: string;
}

interface ManifestDetails {
  version: string;
  runId: string;
  fingerprint: string;
  tool: string;
  timestamp: string;
  input: unknown;
  output: unknown;
  determinism: {
    hashAlgorithm: string;
    digest: string;
    verified: boolean;
  };
  policy: {
    name: string;
    version: string;
    decisions: unknown[];
  };
  dependencies?: Record<string, string>;
}

function getRunPath(runId: string): string {
  return join(process.cwd(), '.requiem', 'runs', `${runId}.json`);
}

function getArtifactPath(artifactId: string): string {
  return join(process.cwd(), '.requiem', 'artifacts', artifactId);
}

function showRun(runId: string, options: { json?: boolean; verbose?: boolean }): RunDetails | null {
  const runPath = getRunPath(runId);

  if (!existsSync(runPath)) {
    // Try looking in other locations
    const altPath = join(process.cwd(), '.requiem', 'runs');
    if (existsSync(altPath)) {
      const files = require('fs').readdirSync(altPath);
      const match = files.find((f: string) => f.startsWith(runId) || f.includes(runId));
      if (match) {
        const fullPath = join(altPath, match);
        const content = readFileSync(fullPath, 'utf-8');
        return JSON.parse(content);
      }
    }
    return null;
  }

  const content = readFileSync(runPath, 'utf-8');
  return JSON.parse(content);
}

function showArtifact(
  artifactId: string,
  options: { json?: boolean; verbose?: boolean; content?: boolean }
): ArtifactDetails | null {
  const artifactPath = getArtifactPath(artifactId);
  const manifestPath = join(artifactPath, 'manifest.json');

  if (!existsSync(manifestPath)) {
    // Try to find by partial match
    const artifactsDir = join(process.cwd(), '.requiem', 'artifacts');
    if (existsSync(artifactsDir)) {
      const files = require('fs').readdirSync(artifactsDir);
      const match = files.find((f: string) => f.includes(artifactId));
      if (match) {
        const fullManifestPath = join(artifactsDir, match, 'manifest.json');
        if (existsSync(fullManifestPath)) {
          const content = readFileSync(fullManifestPath, 'utf-8');
          const manifest = JSON.parse(content);

          const details: ArtifactDetails = {
            id: manifest.id || match,
            type: manifest.type || 'unknown',
            size: manifest.size || 0,
            checksum: manifest.checksum || manifest.hash || 'N/A',
            createdAt: manifest.createdAt || manifest.timestamp || new Date().toISOString(),
            metadata: manifest.metadata,
          };

          if (options.content || options.verbose) {
            const dataPath = join(artifactsDir, match, 'data');
            if (existsSync(dataPath)) {
              details.contents = readFileSync(dataPath, 'utf-8').slice(0, 1000);
            }
          }

          return details;
        }
      }
    }
    return null;
  }

  const content = readFileSync(manifestPath, 'utf-8');
  const manifest = JSON.parse(content);

  const stats = existsSync(artifactPath) ? statSync(artifactPath) : null;

  const details: ArtifactDetails = {
    id: manifest.id || artifactId,
    type: manifest.type || 'unknown',
    size: manifest.size || stats?.size || 0,
    checksum: manifest.checksum || manifest.hash || 'N/A',
    createdAt: manifest.createdAt || manifest.timestamp || new Date().toISOString(),
    metadata: manifest.metadata,
  };

  if (options.content || options.verbose) {
    const dataPath = join(artifactPath, 'data');
    if (existsSync(dataPath)) {
      details.contents = readFileSync(dataPath, 'utf-8').slice(0, 1000);
    }
  }

  return details;
}

function showManifest(
  manifestId: string,
  options: { json?: boolean; verbose?: boolean }
): ManifestDetails | null {
  // Try to find the manifest
  const paths = [
    join(process.cwd(), '.requiem', 'runs', `${manifestId}.json`),
    join(process.cwd(), '.requiem', 'manifests', `${manifestId}.json`),
    join(process.cwd(), '.requiem', 'artifacts', manifestId, 'manifest.json'),
  ];

  for (const path of paths) {
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf-8');
      const data = JSON.parse(content);

      // Convert to manifest format if it's a run
      return {
        version: data.version || '1.0.0',
        runId: data.id || manifestId,
        fingerprint: data.fingerprint || data.resultDigest || 'N/A',
        tool: data.tool || data.command || 'unknown',
        timestamp: data.timestamp || data.createdAt || new Date().toISOString(),
        input: data.input || data.request?.input,
        output: data.output || data.result,
        determinism: {
          hashAlgorithm: 'BLAKE3-v1',
          digest: data.fingerprint || data.resultDigest || 'N/A',
          verified: data.verified || false,
        },
        policy: {
          name: data.policyName || 'default',
          version: data.policyVersion || '1.0.0',
          decisions: data.policyResults || data.decisions || [],
        },
        dependencies: data.dependencies,
      };
    }
  }

  return null;
}

export const show = new Command('show')
  .description('Show detailed information about runs, artifacts, or manifests')
  .argument('<resource>', 'Resource type: run, artifact, manifest')
  .argument('<id>', 'Resource ID')
  .option('--json', 'Output in JSON format')
  .option('--yaml', 'Output in YAML format')
  .option('--verbose', 'Show verbose details')
  .option('--content', 'Show content (for artifacts)')
  .action(async (resource: string, id: string, options) => {
    let result: unknown = null;

    switch (resource) {
      case 'run':
        result = showRun(id, options);
        break;
      case 'artifact':
        result = showArtifact(id, options);
        break;
      case 'manifest':
        result = showManifest(id, options);
        break;
      default:
        console.error(`Unknown resource type: ${resource}`);
        console.error('Supported types: run, artifact, manifest');
        process.exit(1);
    }

    if (!result) {
      console.error(`Resource not found: ${resource} ${id}`);
      process.exit(1);
    }

    if (options.json || options.yaml) {
      if (options.yaml) {
        // Simple YAML conversion
        console.log(JSON.stringify(result, null, 2));
        console.log('\n(YAML output not implemented - showing JSON)');
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    } else {
      printDetails(result, resource);
    }
  });

function printDetails(data: unknown, type: string): void {
  console.log('');

  if (type === 'run') {
    const run = data as RunDetails;
    console.log(`┌${'─'.repeat(60)}┐`);
    console.log(`│ RUN DETAILS: ${run.id.slice(0, 35).padEnd(35)}│`);
    console.log(`├${'─'.repeat(60)}┤`);
    console.log(formatDetail('Tool', run.tool));
    console.log(formatDetail('Status', run.status));
    console.log(formatDetail('Fingerprint', run.fingerprint?.slice(0, 16) || 'N/A'));
    console.log(formatDetail('Duration', run.duration ? `${run.duration}ms` : 'N/A'));
    console.log(formatDetail('Timestamp', run.timestamp));
    if (run.error) {
      console.log(formatDetail('Error', run.error.slice(0, 40)));
    }
    console.log(`└${'─'.repeat(60)}┘`);

    if (run.input) {
      console.log('\n--- INPUT ---');
      console.log(JSON.stringify(run.input, null, 2).slice(0, 500));
    }
    if (run.output) {
      console.log('\n--- OUTPUT ---');
      console.log(JSON.stringify(run.output, null, 2).slice(0, 500));
    }
  } else if (type === 'artifact') {
    const artifact = data as ArtifactDetails;
    console.log(`┌${'─'.repeat(60)}┐`);
    console.log(`│ ARTIFACT DETAILS: ${artifact.id.slice(0, 35).padEnd(35)}│`);
    console.log(`├${'─'.repeat(60)}┤`);
    console.log(formatDetail('Type', artifact.type));
    console.log(formatDetail('Size', `${artifact.size} bytes`));
    console.log(formatDetail('Checksum', artifact.checksum?.slice(0, 16) || 'N/A'));
    console.log(formatDetail('Created', artifact.createdAt));
    console.log(`└${'─'.repeat(60)}┘`);

    if (artifact.contents) {
      console.log('\n--- CONTENT PREVIEW ---');
      console.log(artifact.contents);
    }
  } else if (type === 'manifest') {
    const manifest = data as ManifestDetails;
    console.log(`┌${'─'.repeat(60)}┐`);
    console.log(`│ MANIFEST: ${manifest.runId.slice(0, 43).padEnd(43)}│`);
    console.log(`├${'─'.repeat(60)}┤`);
    console.log(formatDetail('Tool', manifest.tool));
    console.log(formatDetail('Fingerprint', manifest.fingerprint?.slice(0, 16) || 'N/A'));
    console.log(formatDetail('Verified', manifest.determinism.verified ? 'Yes' : 'No'));
    console.log(formatDetail('Policy', manifest.policy.name));
    console.log(formatDetail('Timestamp', manifest.timestamp));
    console.log(`└${'─'.repeat(60)}┘`);
  }

  console.log('');
}

function formatDetail(label: string, value: string): string {
  const content = `│  ${label.padEnd(15)} ${value}`;
  return content.length > 62 ? content.substring(0, 62) + '│' : content.padEnd(62) + '│';
}
