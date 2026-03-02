#!/usr/bin/env node
/**
 * Provenance Command
 * 
 * Generate and verify shareable provenance reports.
 * 
 * Usage:
 *   reach provenance export <run_id> --out <file>
 *   reach provenance verify <file>
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'node:fs';
import { DecisionRepository } from '../db/decisions.js';
import { logger } from '../core/index.js';

const VERSION = '0.2.0';

interface ProvenanceReport {
  version: string;
  generatedAt: string;
  generatedBy: string;
  runId: string;
  fingerprint: string;
  policySnapshotHash: string;
  signingStatus: {
    signed: boolean;
    signerFingerprint?: string;
    signature?: string;
  };
  replayStatus: {
    status: 'canonical' | 'divergent' | 'unverified';
    matchPercent?: number;
  };
  costLedger: {
    totalCostUsd: number;
    promptTokens: number;
    completionTokens: number;
  };
  artifactManifest: {
    hash: string;
    entries: number;
  };
  verificationInstructions: string;
}

/**
 * Export provenance report for a run
 */
async function exportProvenance(runId: string, outPath: string): Promise<void> {
  logger.info('provenance.export_start', 'Starting provenance export', { runId, outPath });

  const decision = DecisionRepository.findById(runId);
  if (!decision) {
    throw new Error(`Run not found: ${runId}`);
  }

  // Parse usage data
  let costLedger = { totalCostUsd: 0, promptTokens: 0, completionTokens: 0 };
  if (decision.usage) {
    try {
      const usage = JSON.parse(decision.usage);
      costLedger = {
        totalCostUsd: usage.cost_usd || 0,
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
      };
    } catch {
      // Ignore parse errors
    }
  }

  const report: ProvenanceReport = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    generatedBy: 'requiem-cli',
    runId: decision.id,
    fingerprint: decision.input_fingerprint,
    policySnapshotHash: decision.policy_snapshot_hash || 'unknown',
    signingStatus: {
      signed: false, // TODO: Check actual signing status
      signerFingerprint: undefined,
      signature: undefined,
    },
    replayStatus: {
      status: 'unverified', // TODO: Check actual replay status
      matchPercent: undefined,
    },
    costLedger,
    artifactManifest: {
      hash: decision.input_fingerprint, // Simplified - would be actual manifest hash
      entries: 1,
    },
    verificationInstructions: generateVerificationInstructions(decision.id),
  };

  writeFileSync(outPath, JSON.stringify(report, null, 2));

  logger.info('provenance.export_complete', 'Provenance export complete', { runId, outPath });

  console.log(`Provenance report exported to ${outPath}`);
  console.log(`Run ID: ${runId}`);
  console.log(`Fingerprint: ${report.fingerprint.substring(0, 16)}...`);
  console.log(`Cost: $${costLedger.totalCostUsd.toFixed(4)}`);
}

/**
 * Verify a provenance report
 */
async function verifyProvenance(filePath: string): Promise<void> {
  logger.info('provenance.verify_start', 'Starting provenance verification', { filePath });

  let report: ProvenanceReport;
  try {
    report = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    throw new Error(`Invalid provenance report: ${filePath}`);
  }

  // Verify structure
  const requiredFields = ['version', 'runId', 'fingerprint', 'generatedAt'];
  for (const field of requiredFields) {
    if (!(field in report)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Verify against database (if available)
  const decision = DecisionRepository.findById(report.runId);
  let verificationStatus = 'verified';
  let mismatches: string[] = [];

  if (decision) {
    if (decision.input_fingerprint !== report.fingerprint) {
      verificationStatus = 'divergent';
      mismatches.push('fingerprint mismatch');
    }
  } else {
    verificationStatus = 'unverified';
    mismatches.push('run not found in local database');
  }

  // Output results
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║           PROVENANCE VERIFICATION                          ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Report Version:  ${report.version.padEnd(38)}║`);
  console.log(`║  Generated:       ${new Date(report.generatedAt).toISOString().slice(0, 19).padEnd(38)}║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  RUN DETAILS                                               ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Run ID:           ${report.runId.substring(0, 38).padEnd(38)}║`);
  console.log(`║  Fingerprint:      ${report.fingerprint.substring(0, 16).padEnd(38)}║`);
  console.log(`║  Policy Snapshot:  ${(report.policySnapshotHash?.substring(0, 16) || 'unknown').padEnd(38)}║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  SIGNING STATUS                                            ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Signed:           ${(report.signingStatus.signed ? 'Yes' : 'No').padEnd(38)}║`);
  if (report.signingStatus.signerFingerprint) {
    console.log(`║  Signer:           ${report.signingStatus.signerFingerprint.substring(0, 16).padEnd(38)}║`);
  }
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  REPLAY STATUS                                             ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Status:           ${report.replayStatus.status.padEnd(38)}║`);
  if (report.replayStatus.matchPercent !== undefined) {
    console.log(`║  Match:            ${(report.replayStatus.matchPercent + '%').padEnd(38)}║`);
  }
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  COST LEDGER                                               ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Total Cost:       $${report.costLedger.totalCostUsd.toFixed(4).padEnd(37)}║`);
  console.log(`║  Prompt Tokens:    ${String(report.costLedger.promptTokens).padEnd(38)}║`);
  console.log(`║  Completion:       ${String(report.costLedger.completionTokens).padEnd(38)}║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  VERIFICATION RESULT                                       ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Status:           ${verificationStatus.toUpperCase().padEnd(38)}║`);
  if (mismatches.length > 0) {
    console.log(`║  Warnings:         ${mismatches.join(', ').substring(0, 38).padEnd(38)}║`);
  }
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  logger.info('provenance.verify_complete', 'Provenance verification complete', {
    runId: report.runId,
    status: verificationStatus,
  });

  if (verificationStatus === 'verified') {
    console.log('✅ Provenance verified successfully\n');
  } else if (verificationStatus === 'divergent') {
    console.log('⚠️  Provenance shows divergence\n');
    process.exit(2);
  } else {
    console.log('ℹ️  Provenance could not be fully verified\n');
  }
}

/**
 * Generate verification instructions
 */
function generateVerificationInstructions(runId: string): string {
  return `
VERIFICATION INSTRUCTIONS
=========================

To verify this provenance report:

1. Import the report:
   reach provenance verify <file>

2. Check the run in your local database:
   reach explain ${runId}

3. Verify the fingerprint matches your records.

4. For cryptographic verification (if signed):
   - Verify the signature against the signer's public key
   - Confirm the signer fingerprint matches a trusted key

This report was generated by Requiem CLI v${VERSION}.
`;
}

// CLI setup
export const provenance = new Command('provenance')
  .description('Generate and verify provenance reports');

provenance
  .command('export')
  .description('Export provenance report for a run')
  .argument('<run_id>', 'Run ID')
  .requiredOption('--out <path>', 'Output file path')
  .action(async (runId: string, options: { out: string }) => {
    try {
      await exportProvenance(runId, options.out);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

provenance
  .command('verify')
  .description('Verify a provenance report')
  .argument('<file>', 'Provenance report file')
  .action(async (file: string) => {
    try {
      await verifyProvenance(file);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Export for programmatic use
export { exportProvenance, verifyProvenance };
export type { ProvenanceReport };
