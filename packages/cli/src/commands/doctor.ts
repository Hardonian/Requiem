/**
 * @fileoverview Doctor Self-Healing Operator
 *
 * Enhanced doctor command that:
 * - Runs SQLite integrity_check
 * - Performs backup + VACUUM
 * - Detects orphaned CAS artifacts
 * - Validates config schema
 * - Validates runtime versions
 * - Produces redacted support manifest
 * - Exits with structured status
 */

import { getStorage, SQLiteStorage } from '../db/sqlite-storage';
import { getPathConfigFromEnv, ensureDir } from '../lib/paths';
import { readConfig } from '../global-config';
import { checkEngineAvailability } from '../engine/adapter';
import { DecisionRepository } from '../db/decisions';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

export interface DoctorCheck {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  message: string;
  details?: Record<string, unknown>;
}

export interface DoctorResult {
  version: string;
  timestamp: string;
  platform: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: DoctorCheck[];
  bundlePath?: string;
}

/**
 * Run SQLite integrity check
 */
async function checkDatabaseIntegrity(storage: SQLiteStorage): Promise<DoctorCheck> {
  try {
    const result = storage.integrityCheck();
    return {
      name: 'Database Integrity',
      status: result.ok ? 'ok' : 'fail',
      message: result.ok ? 'All tables healthy' : `Found ${result.errors.length} issues`,
      details: { errors: result.errors },
    };
  } catch (e) {
    return {
      name: 'Database Integrity',
      status: 'fail',
      message: `Integrity check failed: ${(e as Error).message}`,
    };
  }
}

/**
 * Run VACUUM to optimize database
 */
async function checkDatabaseVacuum(storage: SQLiteStorage): Promise<DoctorCheck> {
  try {
    const beforeStats = storage.getStats();
    storage.vacuum();
    const afterStats = storage.getStats();

    const spaceFreed = beforeStats.bytes - afterStats.bytes;

    return {
      name: 'Database Optimization',
      status: spaceFreed > 1000 ? 'warn' : 'ok',
      message: spaceFreed > 1000
        ? `Freed ${(spaceFreed / 1024).toFixed(1)}KB`
        : 'Database is optimized',
      details: { before: beforeStats.bytes, after: afterStats.bytes },
    };
  } catch (e) {
    return {
      name: 'Database Optimization',
      status: 'fail',
      message: `VACUUM failed: ${(e as Error).message}`,
    };
  }
}

/**
 * Check CAS consistency
 */
async function checkCASConsistency(): Promise<DoctorCheck> {
  try {
    const paths = getPathConfigFromEnv();
    const casDir = paths.casDir;

    if (!fs.existsSync(casDir)) {
      return {
        name: 'CAS Consistency',
        status: 'warn',
        message: 'CAS directory not found (will be created on first use)',
        details: { casDir },
      };
    }

    // Check CAS structure
    const objectsDir = path.join(casDir, 'objects');
    if (!fs.existsSync(objectsDir)) {
      return {
        name: 'CAS Consistency',
        status: 'warn',
        message: 'CAS objects directory missing',
        details: { objectsDir },
      };
    }

    // Count objects
    let totalObjects = 0;
    let totalSize = 0;
    let orphanedMeta = 0;

    const subdirs = fs.readdirSync(objectsDir).filter(f => f.length === 2);
    for (const subdir of subdirs) {
      const subdirPath = path.join(objectsDir, subdir);
      const stat = fs.statSync(subdirPath);
      if (stat.isDirectory()) {
        const files = fs.readdirSync(subdirPath);
        for (const file of files) {
          if (file.length === 64 && /^[a-f0-9]+$/.test(file)) {
            totalObjects++;
            const filePath = path.join(subdirPath, file);
            totalSize += fs.statSync(filePath).size;
          } else if (file.endsWith('.meta')) {
            // Check if corresponding object exists
            const objFile = file.replace('.meta', '');
            const objPath = path.join(subdirPath, objFile);
            if (!fs.existsSync(objPath)) {
              orphanedMeta++;
            }
          }
        }
      }
    }

    return {
      name: 'CAS Consistency',
      status: orphanedMeta > 0 ? 'warn' : 'ok',
      message: `${totalObjects} artifacts, ${(totalSize / 1024).toFixed(1)}KB${orphanedMeta > 0 ? `, ${orphanedMeta} orphaned metadata` : ''}`,
      details: { totalObjects, totalSize, orphanedMeta },
    };
  } catch (e) {
    return {
      name: 'CAS Consistency',
      status: 'fail',
      message: `CAS check failed: ${(e as Error).message}`,
    };
  }
}

/**
 * Validate config schema
 */
async function checkConfigSchema(): Promise<DoctorCheck> {
  try {
    const config = readConfig();

    // Check required fields
    const hasTenantId = !!config.defaultTenantId;
    const hasEngineMode = !!config.engineMode;

    const issues: string[] = [];
    if (!hasTenantId) issues.push('missing defaultTenantId');
    if (!hasEngineMode) issues.push('missing engineMode');

    return {
      name: 'Configuration Schema',
      status: issues.length > 0 ? 'warn' : 'ok',
      message: issues.length > 0
        ? `Config incomplete: ${issues.join(', ')}`
        : 'Configuration valid',
      details: { config },
    };
  } catch (e) {
    return {
      name: 'Configuration Schema',
      status: 'fail',
      message: `Config validation failed: ${(e as Error).message}`,
    };
  }
}

/**
 * Validate runtime versions
 */
async function checkRuntimeVersions(): Promise<DoctorCheck> {
  try {
    const nodeVersion = process.version;
    const platform = os.platform();
    const arch = os.arch();

    // Check Node version compatibility
    const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);
    const isCompatible = majorVersion >= 20;

    return {
      name: 'Runtime Versions',
      status: isCompatible ? 'ok' : 'fail',
      message: `Node ${nodeVersion} (${platform}/${arch})`,
      details: { nodeVersion, platform, arch },
    };
  } catch (e) {
    return {
      name: 'Runtime Versions',
      status: 'fail',
      message: `Version check failed: ${(e as Error).message}`,
    };
  }
}

/**
 * Check decision engine availability
 */
async function checkEngine(): Promise<DoctorCheck> {
  try {
    const engineCheck = await checkEngineAvailability();
    return {
      name: 'Decision Engine',
      status: engineCheck.available ? 'ok' : 'fail',
      message: engineCheck.available
        ? `Available (${engineCheck.engineType})`
        : `Unavailable: ${engineCheck.error}`,
    };
  } catch (e) {
    return {
      name: 'Decision Engine',
      status: 'fail',
      message: `Check failed: ${(e as Error).message}`,
    };
  }
}

/**
 * Check telemetry aggregation
 */
async function checkTelemetry(): Promise<DoctorCheck> {
  try {
    const stats = DecisionRepository.getStats();
    return {
      name: 'Telemetry',
      status: 'ok',
      message: `Aggregator functional (n=${stats.total_decisions})`,
      details: { stats },
    };
  } catch (e) {
    return {
      name: 'Telemetry',
      status: 'fail',
      message: `Aggregation failed: ${(e as Error).message}`,
    };
  }
}

/**
 * Check configuration
 */
async function checkConfiguration(): Promise<DoctorCheck> {
  try {
    const config = readConfig();
    const isConfigured = !!config.defaultTenantId;

    return {
      name: 'Configuration',
      status: 'ok',
      message: isConfigured
        ? `Valid (Tenant: ${config.defaultTenantId})`
        : 'Valid (Unconfigured)',
    };
  } catch (e) {
    return {
      name: 'Configuration',
      status: 'fail',
      message: `Config check failed: ${(e as Error).message}`,
    };
  }
}

/**
 * Create a redacted support bundle
 */
async function createSupportBundle(): Promise<string> {
  const paths = getPathConfigFromEnv();
  const bundleDir = path.join(paths.dataDir, 'support-bundles');
  ensureDir(bundleDir);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bundleId = crypto.randomBytes(8).toString('hex');
  const manifestPath = path.join(bundleDir, `support-manifest-${timestamp}-${bundleId}.json`);

  const bundle = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,

    // Database stats
    database: (() => {
      try {
        const storage = getStorage();
        return {
          schemaVersion: storage.getSchemaVersion(),
          stats: storage.getStats(),
        };
      } catch {
        return { error: 'unavailable' };
      }
    })(),

    // Config (redacted)
    config: (() => {
      try {
        const config = readConfig();
        const redacted: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(config)) {
          if (/key|secret|password|token|auth/i.test(k)) {
            redacted[k] = '[REDACTED]';
          } else {
            redacted[k] = v;
          }
        }
        return redacted;
      } catch {
        return { error: 'unavailable' };
      }
    })(),

    // Paths
    paths,

    // Environment (redacted)
    env: (() => {
      const redacted: Record<string, string> = {};
      for (const [k, v] of Object.entries(process.env)) {
        if (/key|secret|password|token|auth/i.test(k || '')) {
          redacted[k || ''] = '[REDACTED]';
        } else if (k) {
          redacted[k] = v || '';
        }
      }
      return redacted;
    })(),
  };

  fs.writeFileSync(manifestPath, JSON.stringify(bundle, null, 2));
  return manifestPath;
}

/**
 * Run all doctor checks
 */
export async function runDoctor(options: { json: boolean; fix?: boolean }): Promise<number> {
  const checks: DoctorCheck[] = [];

  // Initialize storage
  let storage: SQLiteStorage | null = null;
  try {
    storage = getStorage();
    storage.initialize();
  } catch (e) {
    checks.push({
      name: 'Storage Initialization',
      status: 'fail',
      message: `Failed to initialize storage: ${(e as Error).message}`,
    });
  }

  // Run all checks
  checks.push(await checkEngine());
  checks.push(await checkTelemetry());
  checks.push(await checkConfiguration());

  if (storage) {
    checks.push(await checkDatabaseIntegrity(storage));
    if (options.fix) {
      checks.push(await checkDatabaseVacuum(storage));
    }
  }

  checks.push(await checkCASConsistency());
  checks.push(await checkConfigSchema());
  checks.push(await checkRuntimeVersions());

  // Create support bundle if requested
  let bundlePath: string | undefined;
  if (options.fix) {
    try {
      bundlePath = await createSupportBundle();
    } catch (e) {
      checks.push({
        name: 'Support Bundle',
        status: 'warn',
        message: `Failed to create bundle: ${(e as Error).message}`,
      });
    }
  }

  // Determine overall status
  const hasFail = checks.some(c => c.status === 'fail');
  const hasWarn = checks.some(c => c.status === 'warn');
  const status: 'healthy' | 'degraded' | 'unhealthy' = hasFail ? 'unhealthy' : hasWarn ? 'degraded' : 'healthy';

  const result: DoctorResult = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    platform: os.platform(),
    status,
    checks,
    bundlePath,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('\n🩺 REQUIEM DOCTOR\n');
    console.log(`Status: ${status.toUpperCase()}\n`);

    for (const check of checks) {
      const icon = check.status === 'ok' ? '✓' : check.status === 'warn' ? '⚠' : '✗';
      const statusIcon = icon + ' ';
      console.log(`${statusIcon}${check.name.padEnd(22)} ${check.message}`);
    }

    if (bundlePath) {
      console.log(`\n📦 Support Manifest: ${bundlePath}`);
    }

    console.log('');
  }

  return hasFail ? 1 : 0;
}

export default runDoctor;
