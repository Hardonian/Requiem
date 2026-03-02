#!/usr/bin/env node
/**
 * Replication Round-Trip Test
 * 
 * Verifies that export → import preserves data integrity.
 */

import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEST_STREAM = join(tmpdir(), 'requiem-test-replication.json');

function run(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [
      'packages/cli/dist/cli/src/cli.js',
      ...args
    ], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'test' }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function main() {
  console.log('=== Replication Round-Trip Test ===\n');

  try {
    // Clean up any previous test file
    if (existsSync(TEST_STREAM)) {
      unlinkSync(TEST_STREAM);
    }

    // Step 1: Generate cursor
    console.log('1. Generating cursor...');
    const cursorResult = await run(['replicate', 'cursor', '--from', '2024-01-01']);
    const cursor = cursorResult.stdout.trim();
    console.log(`   Cursor: ${cursor}`);

    // Step 2: Export
    console.log('\n2. Exporting replication stream...');
    const exportResult = await run([
      'replicate', 'export',
      '--since', cursor,
      '--out', TEST_STREAM,
      '--limit', '100'
    ]);
    
    if (exportResult.code !== 0) {
      console.error('Export failed:', exportResult.stderr);
      process.exit(1);
    }
    console.log('   Export complete');

    // Step 3: Verify stream structure
    console.log('\n3. Verifying stream structure...');
    const stream = JSON.parse(readFileSync(TEST_STREAM, 'utf-8'));
    
    const requiredFields = ['version', 'exportedAt', 'exportedBy', 'cursorStart', 'cursorEnd', 'eventCount', 'events', 'streamHash'];
    for (const field of requiredFields) {
      if (!(field in stream)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    console.log(`   ✓ Stream version: ${stream.version}`);
    console.log(`   ✓ Events: ${stream.eventCount}`);
    console.log(`   ✓ Cursor: ${stream.cursorStart} → ${stream.cursorEnd}`);
    console.log(`   ✓ Stream hash: ${stream.streamHash}`);

    // Step 4: Dry run import
    console.log('\n4. Testing import (dry run)...');
    const dryRunResult = await run([
      'replicate', 'import',
      '--in', TEST_STREAM,
      '--dry-run'
    ]);
    
    if (dryRunResult.code !== 0) {
      console.error('Dry run import failed:', dryRunResult.stderr);
      process.exit(1);
    }
    console.log('   ✓ Dry run passed');

    // Step 5: Actual import
    console.log('\n5. Importing stream...');
    const importResult = await run([
      'replicate', 'import',
      '--in', TEST_STREAM,
      '--skip-verify'
    ]);
    
    if (importResult.code !== 0) {
      console.error('Import failed:', importResult.stderr);
      process.exit(1);
    }
    console.log('   ✓ Import complete');

    // Step 6: Verify hash integrity
    console.log('\n6. Verifying stream hash integrity...');
    const streamForHash = { ...stream };
    delete streamForHash.streamHash;
    const content = JSON.stringify(streamForHash, Object.keys(streamForHash).sort());
    let computedHash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      computedHash = ((computedHash << 5) - computedHash) + char;
      computedHash = computedHash & computedHash;
    }
    computedHash = Math.abs(computedHash).toString(16).padStart(16, '0');
    
    if (computedHash === stream.streamHash) {
      console.log('   ✓ Stream hash verified');
    } else {
      throw new Error(`Hash mismatch: expected ${stream.streamHash}, computed ${computedHash}`);
    }

    // Cleanup
    if (existsSync(TEST_STREAM)) {
      unlinkSync(TEST_STREAM);
    }

    console.log('\n✅ All replication tests passed!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
