#!/usr/bin/env node
/**
 * @fileoverview Whoami command - Show current user and entitlements context.
 *
 * Displays:
 * - Current tenant ID
 * - User/principal information
 * - Entitlements and capabilities
 * - Role and permission scope
 * - Quota information
 *
 * Output formats: --json, --jsonl, --table
 */

import { Command } from 'commander';
import { readConfig } from '../global-config.js';

const VERSION = '0.2.0';

interface Identity {
  tenantId: string;
  userId?: string;
  principal?: string;
  email?: string;
}

interface Entitlement {
  name: string;
  enabled: boolean;
  limit?: number;
  used?: number;
  scope: string[];
}

interface RoleInfo {
  name: string;
  permissions: string[];
  inherits?: string[];
}

interface QuotaInfo {
  computeUnits: { limit: number; used: number; resetAt?: string };
  storageBytes: { limit: number; used: number; resetAt?: string };
  requestsPerMinute: { limit: number; used: number };
}

function getIdentity(): Identity {
  const config = readConfig();

  return {
    tenantId: config.defaultTenantId || 'default',
    userId: process.env.REQUIEM_USER_ID,
    principal: process.env.REQUIEM_PRINCIPAL || process.env.USER || 'local',
    email: process.env.REQUIEM_USER_EMAIL,
  };
}

function getEntitlements(): Entitlement[] {
  const isEnterprise = process.env.REQUIEM_ENTERPRISE === 'true';

  const entitlements: Entitlement[] = [
    {
      name: 'deterministic_execution',
      enabled: true,
      scope: ['run', 'verify', 'replay'],
    },
    {
      name: 'policy_enforcement',
      enabled: true,
      scope: ['create_policy', 'update_policy', 'delete_policy'],
    },
    {
      name: 'artifact_storage',
      enabled: true,
      limit: isEnterprise ? 10000000000 : 1000000000, // 10GB vs 1GB
      used: 0,
      scope: ['read', 'write', 'delete'],
    },
    {
      name: 'provider_access',
      enabled: true,
      scope: ['openai', 'anthropic', 'google'],
    },
    {
      name: 'replay_capability',
      enabled: true,
      scope: ['replay', 'diff', 'verify'],
    },
    {
      name: 'multi_tenant',
      enabled: isEnterprise,
      scope: isEnterprise ? ['create_tenant', 'manage_tenant'] : [],
    },
    {
      name: 'signed_bundles',
      enabled: isEnterprise,
      scope: isEnterprise ? ['sign', 'verify'] : [],
    },
    {
      name: 'audit_logs',
      enabled: isEnterprise,
      scope: isEnterprise ? ['read', 'export'] : [],
    },
  ];

  return entitlements;
}

function getRoleInfo(): RoleInfo {
  const isEnterprise = process.env.REQUIEM_ENTERPRISE === 'true';

  if (isEnterprise) {
    return {
      name: 'enterprise_admin',
      permissions: [
        'run:execute',
        'policy:*',
        'tenant:*',
        'audit:read',
        'audit:export',
        'replay:*',
        'config:*',
      ],
      inherits: ['developer'],
    };
  }

  return {
    name: 'developer',
    permissions: [
      'run:execute',
      'run:verify',
      'run:replay',
      'artifact:read',
      'artifact:write',
      'policy:read',
      'config:read',
    ],
  };
}

function getQuotaInfo(): QuotaInfo {
  const isEnterprise = process.env.REQUIEM_ENTERPRISE === 'true';

  return {
    computeUnits: {
      limit: isEnterprise ? 1000000 : 100000,
      used: Math.floor(Math.random() * 10000), // Placeholder
    },
    storageBytes: {
      limit: isEnterprise ? 10000000000 : 1000000000,
      used: Math.floor(Math.random() * 1000000), // Placeholder
    },
    requestsPerMinute: {
      limit: isEnterprise ? 1000 : 100,
      used: Math.floor(Math.random() * 50), // Placeholder
    },
  };
}

export const whoami = new Command('whoami')
  .description('Show current user and entitlements context')
  .option('--json', 'Output in JSON format')
  .option('--jsonl', 'Output in JSONL format')
  .option('--format <type>', 'Output format: json, jsonl, table', 'table')
  .option('--verbose', 'Show detailed entitlements and quotas')
  .action(async (options) => {
    const identity = getIdentity();
    const entitlements = getEntitlements();
    const role = getRoleInfo();
    const quota = getQuotaInfo();

    const output = {
      identity,
      entitlements,
      role,
      quota,
      timestamp: new Date().toISOString(),
    };

    if (options.json || options.format === 'json') {
      console.log(JSON.stringify(output, null, 2));
    } else if (options.jsonl || options.format === 'jsonl') {
      console.log(JSON.stringify(identity));
      for (const ent of entitlements) {
        console.log(JSON.stringify(ent));
      }
      console.log(JSON.stringify(role));
      console.log(JSON.stringify(quota));
    } else {
      printWhoami(identity, entitlements, role, quota, options.verbose);
    }
  });

function printWhoami(
  identity: Identity,
  entitlements: Entitlement[],
  role: RoleInfo,
  quota: QuotaInfo,
  verbose: boolean
): void {
  console.log('');
  console.log(`┌${'─'.repeat(52)}┐`);
  console.log(`│ Requiem Identity & Entitlements`.padEnd(53) + '│');
  console.log(`├${'─'.repeat(52)}┤`);

  // Identity section
  console.log(formatSection('IDENTITY'));
  console.log(formatRow('Tenant ID', identity.tenantId));
  if (identity.userId) console.log(formatRow('User ID', identity.userId));
  console.log(formatRow('Principal', identity.principal || 'unknown'));
  if (identity.email) console.log(formatRow('Email', identity.email));

  console.log(`├${'─'.repeat(52)}┤`);

  // Role section
  console.log(formatSection('ROLE'));
  console.log(formatRow('Role', role.name));
  console.log(formatRow('Permissions', role.permissions.slice(0, 3).join(', ')));
  if (role.inherits) {
    console.log(formatRow('Inherits', role.inherits.join(', ')));
  }

  if (verbose) {
    console.log(`├${'─'.repeat(52)}┤`);
    console.log(formatSection('ENTITLEMENTS'));

    for (const ent of entitlements) {
      const status = ent.enabled ? '✓' : '✗';
      const limit = ent.limit ? ` (${formatNumber(ent.used || 0)}/${formatNumber(ent.limit)})` : '';
      console.log(formatRow(`${status} ${ent.name}`, limit || ent.scope.join(', ')));
    }

    console.log(`├${'─'.repeat(52)}┤`);
    console.log(formatSection('QUOTA'));

    const computeUsedPct = (quota.computeUnits.used / quota.computeUnits.limit * 100).toFixed(1);
    console.log(
      formatRow(
        'Compute Units',
        `${formatNumber(quota.computeUnits.used)} / ${formatNumber(quota.computeUnits.limit)} (${computeUsedPct}%)`
      )
    );

    const storageUsedPct = (quota.storageBytes.used / quota.storageBytes.limit * 100).toFixed(1);
    console.log(
      formatRow(
        'Storage',
        `${formatBytes(quota.storageBytes.used)} / ${formatBytes(quota.storageBytes.limit)} (${storageUsedPct}%)`
      )
    );

    const rpmUsedPct = (quota.requestsPerMinute.used / quota.requestsPerMinute.limit * 100).toFixed(1);
    console.log(
      formatRow(
        'Requests/min',
        `${quota.requestsPerMinute.used} / ${quota.requestsPerMinute.limit} (${rpmUsedPct}%)`
      )
    );
  }

  console.log(`├${'─'.repeat(52)}┤`);
  console.log(formatRow('Timestamp', new Date().toISOString()));
  console.log(`└${'─'.repeat(52)}┘`);
  console.log('');
}

function formatRow(label: string, value: string): string {
  const content = `│  ${label.padEnd(18)} ${value}`;
  return content.length > 53 ? content.substring(0, 53) + '│' : content.padEnd(53) + '│';
}

function formatSection(title: string): string {
  return `│ ${title}`.padEnd(53) + '│';
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
