#!/usr/bin/env node
/**
 * Entitlement Command
 * 
 * View and verify feature entitlements.
 * 
 * Usage:
 *   reach entitlement show [--json]
 *   reach entitlement verify
 */

import { Command } from 'commander';
import {
  loadEntitlements,
  getEntitlementsSummary,
  isFeatureEnabled,
  getQuota,
  policyGate,
  clearEntitlementsCache,
} from '../lib/entitlements.js';
import { logger } from '../core/index.js';

export const entitlement = new Command('entitlement')
  .description('Manage feature entitlements and quotas');

// Show command
entitlement
  .command('show')
  .description('Show current entitlements')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      // Clear cache to get fresh data
      clearEntitlementsCache();
      
      const entitlements = loadEntitlements();
      const summary = getEntitlementsSummary();
      
      if (options.json) {
        console.log(JSON.stringify({
          tier: entitlements.tier,
          source: entitlements.source,
          features: entitlements.features,
          quotas: entitlements.quotas,
        }, null, 2));
        return;
      }
      
      console.log('\n╔══════════════════════════════════════════════════════════╗');
      console.log('║              ENTITLEMENTS                                ║');
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log(`║  Tier:   ${entitlements.tier.padEnd(46)}║`);
      console.log(`║  Source: ${entitlements.source.padEnd(46)}║`);
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log('║  FEATURES                                                ║');
      console.log('╠══════════════════════════════════════════════════════════╣');
      
      const features = [
        ['Replication', entitlements.features.replication],
        ['Auto Arbitration', entitlements.features.arbitrationAutoMode],
        ['Signing Required', entitlements.features.signingRequired],
        ['Multi-Region', entitlements.features.multiRegion],
        ['Advanced Analytics', entitlements.features.advancedAnalytics],
        ['Priority Support', entitlements.features.prioritySupport],
      ];
      
      for (const [name, enabled] of features) {
        const status = enabled ? '✓ ENABLED' : '✗ disabled';
        console.log(`║  ${name.padEnd(20)} ${status.padEnd(27)}║`);
      }
      
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log('║  LIMITS                                                  ║');
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log(`║  Max Export Size:    ${formatBytes(entitlements.features.maxExportSizeBytes).padEnd(37)}║`);
      console.log(`║  Max Retention:      ${(entitlements.features.maxRunRetentionDays + ' days').padEnd(37)}║`);
      console.log(`║  Max Concurrency:    ${String(entitlements.features.maxConcurrency).padEnd(37)}║`);
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log('║  QUOTAS                                                ║');
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log(`║  Runs/Month:         ${String(entitlements.quotas.runsPerMonth).padEnd(37)}║`);
      console.log(`║  Decisions/Month:    ${String(entitlements.quotas.decisionsPerMonth).padEnd(37)}║`);
      console.log(`║  Storage:            ${formatBytes(entitlements.quotas.storageBytes).padEnd(37)}║`);
      console.log('╚══════════════════════════════════════════════════════════╝\n');
      
      logger.info('entitlement.show', 'Displayed entitlements', {
        tier: entitlements.tier,
        source: entitlements.source,
      });
      
    } catch (error) {
      console.error('Error loading entitlements:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Verify command
entitlement
  .command('verify')
  .description('Verify active feature gates and limits')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      clearEntitlementsCache();
      
      const results = {
        timestamp: new Date().toISOString(),
        checks: {
          replication: policyGate('replication'),
          arbitrationAuto: policyGate('arbitration_auto'),
          signing: policyGate('signing'),
          export: policyGate('export', { exportSizeBytes: 1024 * 1024 }), // Test with 1MB
        },
        features: {
          replication: isFeatureEnabled('replication'),
          arbitrationAutoMode: isFeatureEnabled('arbitrationAutoMode'),
          signingRequired: isFeatureEnabled('signingRequired'),
          multiRegion: isFeatureEnabled('multiRegion'),
        },
        quotas: {
          runsPerMonth: getQuota('runsPerMonth'),
          decisionsPerMonth: getQuota('decisionsPerMonth'),
          storageBytes: getQuota('storageBytes'),
        },
      };
      
      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }
      
      console.log('\n╔══════════════════════════════════════════════════════════╗');
      console.log('║           ENTITLEMENT VERIFICATION                       ║');
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log('║  POLICY GATE CHECKS                                      ║');
      console.log('╠══════════════════════════════════════════════════════════╣');
      
      for (const [name, result] of Object.entries(results.checks)) {
        const status = result.allowed ? '✓ PASS' : '✗ FAIL';
        const reason = result.reason ? ` (${result.reason})` : '';
        console.log(`║  ${name.padEnd(18)} ${(status + reason).slice(0, 38).padEnd(39)}║`);
      }
      
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log('║  FEATURE FLAGS                                           ║');
      console.log('╠══════════════════════════════════════════════════════════╣');
      
      for (const [name, enabled] of Object.entries(results.features)) {
        const status = enabled ? '✓ ENABLED' : '✗ disabled';
        console.log(`║  ${name.padEnd(18)} ${status.padEnd(39)}║`);
      }
      
      console.log('╚══════════════════════════════════════════════════════════╝\n');
      
      const allPassed = Object.values(results.checks).every(c => c.allowed);
      
      if (allPassed) {
        console.log('✅ All entitlement checks passed\n');
        process.exit(0);
      } else {
        console.log('⚠️  Some entitlement checks failed (upgrade tier to enable)\n');
        process.exit(0); // Not a failure - just informational
      }
      
    } catch (error) {
      console.error('Error verifying entitlements:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Helper function
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Export for programmatic use
export { loadEntitlements, getEntitlementsSummary, policyGate };
