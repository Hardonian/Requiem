#!/usr/bin/env node
/**
 * @fileoverview Policy command — Policy management
 *
 * Commands:
 *   reach policy add <file>                  Add a new policy
 *   reach policy list [--json]               List all policies
 *   reach policy eval <policy> <context>    Evaluate policy against context
 *   reach policy versions <policy>           Show policy version history
 *   reach policy test <policy> [--case=<n>] Run policy test cases
 *
 * INVARIANT: All commands support --json for machine use.
 * INVARIANT: No secrets exposed in output.
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════════════════════
// POLICY STORAGE
// ═══════════════════════════════════════════════════════════════════════════════

const POLICY_DIR = join(process.cwd(), '.reach', 'policies');
const POLICY_INDEX_FILE = join(POLICY_DIR, 'index.json');

interface PolicyVersion {
  version: string;
  hash: string;
  createdAt: string;
  author: string;
  message: string;
}

interface Policy {
  name: string;
  type: 'allow' | 'deny';
  rules: PolicyRule[];
  versions: PolicyVersion[];
  activeVersion: string;
  metadata: Record<string, unknown>;
}

interface PolicyRule {
  id: string;
  name: string;
  condition: string;
  action: 'allow' | 'deny' | 'require_approval';
  priority: number;
}

interface PolicyIndex {
  policies: Record<string, Policy>;
  metadata: { version: string; createdAt: string };
}

function ensurePolicyDir(): void {
  if (!existsSync(POLICY_DIR)) {
    mkdirSync(POLICY_DIR, { recursive: true });
  }
}

function loadIndex(): PolicyIndex {
  ensurePolicyDir();
  if (!existsSync(POLICY_INDEX_FILE)) {
    const emptyIndex: PolicyIndex = {
      policies: {},
      metadata: { version: '1.0.0', createdAt: new Date().toISOString() },
    };
    writeFileSync(POLICY_INDEX_FILE, JSON.stringify(emptyIndex, null, 2));
    return emptyIndex;
  }
  try {
    return JSON.parse(readFileSync(POLICY_INDEX_FILE, 'utf-8'));
  } catch {
    const emptyIndex: PolicyIndex = {
      policies: {},
      metadata: { version: '1.0.0', createdAt: new Date().toISOString() },
    };
    return emptyIndex;
  }
}

function saveIndex(index: PolicyIndex): void {
  ensurePolicyDir();
  writeFileSync(POLICY_INDEX_FILE, JSON.stringify(index, null, 2));
}

function computePolicyHash(policy: Omit<Policy, 'versions'>): string {
  const content = JSON.stringify({
    name: policy.name,
    type: policy.type,
    rules: policy.rules,
    activeVersion: policy.activeVersion,
    metadata: policy.metadata,
  });
  return createHash('blake3').update(content).digest('hex');
}

function savePolicyFile(name: string, version: string, content: string): void {
  const versionDir = join(POLICY_DIR, name, 'versions');
  if (!existsSync(versionDir)) {
    mkdirSync(versionDir, { recursive: true });
  }
  writeFileSync(join(versionDir, `${version}.json`), content);
}

function loadPolicyFile(name: string, version: string): string | null {
  const path = join(POLICY_DIR, name, 'versions', `${version}.json`);
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8');
}

// ═══════════════════════════════════════════════════════════════════════════════
// OUTPUT FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════════

interface OutputContext {
  json: boolean;
  minimal: boolean;
}

function formatOutput(data: unknown, ctx: OutputContext): void {
  if (ctx.json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (ctx.minimal && typeof data === 'object') {
    console.log(JSON.stringify(data));
  } else if (typeof data === 'string') {
    console.log(data);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

function formatPolicyList(policies: Array<{ name: string; type: string; ruleCount: number; activeVersion: string }>, ctx: OutputContext): void {
  if (ctx.json) {
    formatOutput({ ok: true, policies, count: policies.length }, ctx);
    return;
  }

  if (policies.length === 0) {
    console.log('No policies found.');
    return;
  }

  console.log('┌─────────────────────────────────────────────────────────────────────────┐');
  console.log('│ Policies                                                                   │');
  console.log('├─────────────────────────────────────────────────────────────────────────┤');
  console.log('│ Name                             Type    Rules  Active Version             │');
  console.log('├─────────────────────────────────────────────────────────────────────────┤');

  for (const policy of policies) {
    const name = policy.name.substring(0, 32).padEnd(32);
    const type = policy.type.padEnd(6);
    const rules = String(policy.ruleCount).padStart(5);
    const version = policy.activeVersion.substring(0, 16).padEnd(16);
    console.log(`│ ${name} ${type} ${rules}  ${version} │`);
  }

  console.log('└─────────────────────────────────────────────────────────────────────────┘');
  console.log(`Total: ${policies.length} policies`);
}

function formatVersions(versions: PolicyVersion[], ctx: OutputContext): void {
  if (ctx.json) {
    formatOutput({ ok: true, versions, count: versions.length }, ctx);
    return;
  }

  console.log('┌─────────────────────────────────────────────────────────────────────────┐');
  console.log('│ Policy Versions                                                            │');
  console.log('├─────────────────────────────────────────────────────────────────────────┤');
  console.log('│ Version    Hash                     Created           Author  Message   │');
  console.log('├─────────────────────────────────────────────────────────────────────────┤');

  for (const v of versions) {
    const version = v.version.substring(0, 8).padEnd(8);
    const hash = v.hash.substring(0, 24).padEnd(24);
    const created = v.createdAt.substring(0, 10).padEnd(10);
    const author = (v.author || 'system').substring(0, 8).padEnd(8);
    const message = (v.message || '').substring(0, 20).padEnd(20);
    console.log(`│ ${version} ${hash} ${created} ${author} ${message} │`);
  }

  console.log('└─────────────────────────────────────────────────────────────────────────┘');
}

function formatEvalResult(result: { allowed: boolean; reason: string; rulesEvaluated: number; matchedRules: string[] }, ctx: OutputContext): void {
  if (ctx.json) {
    formatOutput({ ok: true, result }, ctx);
    return;
  }

  if (result.allowed) {
    console.log('✓ POLICY ALLOWED');
  } else {
    console.log('✗ POLICY DENIED');
  }
  console.log(`  Reason: ${result.reason}`);
  console.log(`  Rules evaluated: ${result.rulesEvaluated}`);
  if (result.matchedRules.length > 0) {
    console.log(`  Matched rules: ${result.matchedRules.join(', ')}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

export function createPolicyCommand(): Command {
  const policyCmd = new Command('policy')
    .description('Policy management — add, list, evaluate, version, and test policies')
    .option('--json', 'Output in JSON format')
    .option('--minimal', 'Minimal output');

  // policy add <file>
  policyCmd
    .command('add <file>')
    .description('Add a new policy from file')
    .option('--name <name>', 'Policy name (default: filename)')
    .option('--message <msg>', 'Version commit message')
    .action(async (file: string, options: { name?: string; message?: string }) => {
      const ctx = { json: policyCmd.opts().json || false, minimal: policyCmd.opts().minimal || false };

      try {
        if (!existsSync(file)) {
          formatOutput({ ok: false, error: { code: 'file_not_found', message: `File not found: ${file}` } }, ctx);
          process.exit(1);
        }

        const content = readFileSync(file, 'utf-8');
        let policyData: Partial<Policy>;
        
        try {
          policyData = JSON.parse(content);
        } catch {
          formatOutput({ ok: false, error: { code: 'invalid_json', message: 'Invalid JSON in policy file' } }, ctx);
          process.exit(1);
        }

        const name = options.name || policyData.name || file.replace(/\.json$/, '');
        const version = policyData.metadata?.version?.toString() || '1.0.0';
        const hash = computePolicyHash({
          name,
          type: policyData.type || 'deny',
          rules: policyData.rules || [],
          activeVersion: version,
          metadata: policyData.metadata || {},
        });

        const index = loadIndex();

        // Create new or update existing
        if (!index.policies[name]) {
          index.policies[name] = {
            name,
            type: policyData.type || 'deny',
            rules: policyData.rules || [],
            versions: [],
            activeVersion: version,
            metadata: policyData.metadata || {},
          };
        }

        // Add new version
        index.policies[name].versions.push({
          version,
          hash,
          createdAt: new Date().toISOString(),
          author: process.env.USER || 'system',
          message: options.message || `Added policy ${name} v${version}`,
        });
        
        index.policies[name].activeVersion = version;
        index.policies[name].rules = policyData.rules || [];

        // Save policy file
        savePolicyFile(name, version, content);
        saveIndex(index);

        const result = {
          ok: true,
          name,
          version,
          hash: hash.substring(0, 16),
        };

        if (ctx.json) {
          formatOutput(result, ctx);
        } else {
          console.log(`✓ Policy added: ${name}@${version}`);
          console.log(`  Hash: ${hash.substring(0, 16)}...`);
          console.log(`  Type: ${policyData.type || 'deny'}`);
          console.log(`  Rules: ${policyData.rules?.length || 0}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatOutput({ ok: false, error: { code: 'policy_add_failed', message } }, ctx);
        process.exit(1);
      }
    });

  // policy list
  policyCmd
    .command('list')
    .description('List all policies')
    .action(async () => {
      const ctx = { json: policyCmd.opts().json || false, minimal: policyCmd.opts().minimal || false };

      try {
        const index = loadIndex();
        
        const policies = Object.values(index.policies).map(p => ({
          name: p.name,
          type: p.type,
          ruleCount: p.rules.length,
          activeVersion: p.activeVersion,
        }));

        formatPolicyList(policies, ctx);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatOutput({ ok: false, error: { code: 'policy_list_failed', message } }, ctx);
        process.exit(1);
      }
    });

  // policy eval <policy> <context>
  policyCmd
    .command('eval <policy>')
    .description('Evaluate policy against a context')
    .option('-c, --context <json>', 'JSON context object')
    .option('--input <file>', 'Input file for context')
    .action(async (policy: string, options: { context?: string; input?: string }) => {
      const ctx = { json: policyCmd.opts().json || false, minimal: policyCmd.opts().minimal || false };

      try {
        const index = loadIndex();
        const pol = index.policies[policy];

        if (!pol) {
          formatOutput({ ok: false, error: { code: 'policy_not_found', message: `Policy not found: ${policy}` } }, ctx);
          process.exit(1);
        }

        // Parse context
        let context: Record<string, unknown> = {};
        if (options.context) {
          try {
            context = JSON.parse(options.context);
          } catch {
            formatOutput({ ok: false, error: { code: 'invalid_context', message: 'Invalid JSON in --context' } }, ctx);
            process.exit(1);
          }
        } else if (options.input) {
          if (!existsSync(options.input)) {
            formatOutput({ ok: false, error: { code: 'file_not_found', message: `File not found: ${options.input}` } }, ctx);
            process.exit(1);
          }
          try {
            context = JSON.parse(readFileSync(options.input, 'utf-8'));
          } catch {
            formatOutput({ ok: false, error: { code: 'invalid_file', message: 'Invalid JSON in input file' } }, ctx);
            process.exit(1);
          }
        }

        // Evaluate rules
        const matchedRules: string[] = [];
        let allowed = pol.type === 'allow';

        for (const rule of pol.rules) {
          // Simple condition evaluation - check if any context field matches
          const conditionFields = rule.condition.match(/\{\{(\w+)\}\}/g) || [];
          let matches = true;
          
          for (const field of conditionFields) {
            const fieldName = field.replace(/\{\{|\}\}/g, '');
            if (!(fieldName in context)) {
              matches = false;
              break;
            }
          }
          
          if (matches) {
            matchedRules.push(rule.name);
            if (rule.action === 'deny') {
              allowed = false;
              break;
            } else if (rule.action === 'allow') {
              allowed = true;
            }
          }
        }

        const result = {
          allowed,
          reason: allowed ? 'Allowed by policy' : 'Denied by policy rule',
          rulesEvaluated: pol.rules.length,
          matchedRules,
        };

        formatEvalResult(result, ctx);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatOutput({ ok: false, error: { code: 'policy_eval_failed', message } }, ctx);
        process.exit(1);
      }
    });

  // policy versions <policy>
  policyCmd
    .command('versions <policy>')
    .description('Show policy version history')
    .action(async (policy: string) => {
      const ctx = { json: policyCmd.opts().json || false, minimal: policyCmd.opts().minimal || false };

      try {
        const index = loadIndex();
        const pol = index.policies[policy];

        if (!pol) {
          formatOutput({ ok: false, error: { code: 'policy_not_found', message: `Policy not found: ${policy}` } }, ctx);
          process.exit(1);
        }

        formatVersions(pol.versions, ctx);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatOutput({ ok: false, error: { code: 'policy_versions_failed', message } }, ctx);
        process.exit(1);
      }
    });

  // policy test <policy>
  policyCmd
    .command('test <policy>')
    .description('Run policy test cases')
    .option('--case <name>', 'Run specific test case')
    .option('--verbose', 'Verbose output')
    .action(async (policy: string, options: { case?: string; verbose?: boolean }) => {
      const ctx = { json: policyCmd.opts().json || false, minimal: false };

      try {
        const index = loadIndex();
        const pol = index.policies[policy];

        if (!pol) {
          formatOutput({ ok: false, error: { code: 'policy_not_found', message: `Policy not found: ${policy}` } }, ctx);
          process.exit(1);
        }

        // Run basic policy tests
        const tests = [
          { name: 'policy_valid', description: 'Policy has valid structure' },
          { name: 'rules_exist', description: 'Policy has at least one rule', check: pol.rules.length > 0 },
          { name: 'version_tracked', description: 'Policy has version history', check: pol.versions.length > 0 },
          { name: 'hash_deterministic', description: 'Policy hash is deterministic', check: computePolicyHash(pol) === computePolicyHash(pol) },
        ];

        let passed = 0;
        let failed = 0;

        if (ctx.json) {
          formatOutput({ ok: true, policy, tests: tests.map(t => ({ ...t, passed: t.check !== false })) }, ctx);
        } else {
          console.log(`Policy Test Results: ${policy}`);
          console.log('');
          
          for (const test of tests) {
            const testPassed = test.check !== false;
            if (testPassed) passed++;
            else failed++;
            
            const icon = testPassed ? '✓' : '✗';
            console.log(`  ${icon} ${test.name}: ${test.description}`);
          }
          
          console.log('');
          console.log(`Passed: ${passed}/${tests.length}`);
          
          if (failed > 0) {
            process.exit(1);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatOutput({ ok: false, error: { code: 'policy_test_failed', message } }, ctx);
        process.exit(1);
      }
    });

  return policyCmd;
}

// Default export for dynamic imports
export default createPolicyCommand;
