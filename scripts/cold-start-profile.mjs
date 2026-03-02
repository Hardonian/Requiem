#!/usr/bin/env node
/**
 * Cold Start Profiler - Measure CLI startup latency
 * 
 * Usage: node scripts/cold-start-profile.mjs [command]
 */

import { performance } from 'node:perf_hooks';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

async function measureColdStart(command, args = []) {
  const start = performance.now();
  
  return new Promise((resolve) => {
    const proc = spawn('node', [
      join(rootDir, 'packages/cli/dist/cli/src/cli.js'),
      command,
      ...args
    ], {
      cwd: rootDir,
      env: { ...process.env, NODE_ENV: 'production' }
    });

    let firstOutput = null;
    const chunks = [];

    proc.stdout.on('data', (data) => {
      if (!firstOutput) {
        firstOutput = performance.now() - start;
      }
      chunks.push(data.toString());
    });

    proc.stderr.on('data', (data) => {
      if (!firstOutput) {
        firstOutput = performance.now() - start;
      }
      chunks.push(data.toString());
    });

    proc.on('close', (code) => {
      const totalTime = performance.now() - start;
      resolve({
        command,
        args,
        firstOutputMs: firstOutput || totalTime,
        totalMs: totalTime,
        exitCode: code,
        output: chunks.join('').slice(0, 500)
      });
    });
  });
}

async function main() {
  console.log('=== Cold Start Profiling ===\n');

  const results = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    measurements: []
  };

  // Warm up
  console.log('Warming up...');
  await measureColdStart('--help');

  // Measure help
  console.log('Measuring: reach --help');
  const helpResult = await measureColdStart('--help');
  results.measurements.push(helpResult);
  console.log(`  First output: ${helpResult.firstOutputMs.toFixed(2)}ms`);
  console.log(`  Total time: ${helpResult.totalMs.toFixed(2)}ms\n`);

  // Measure version
  console.log('Measuring: reach version');
  const versionResult = await measureColdStart('version');
  results.measurements.push(versionResult);
  console.log(`  First output: ${versionResult.firstOutputMs.toFixed(2)}ms`);
  console.log(`  Total time: ${versionResult.totalMs.toFixed(2)}ms\n`);

  // Measure status
  console.log('Measuring: reach status');
  const statusResult = await measureColdStart('status');
  results.measurements.push(statusResult);
  console.log(`  First output: ${statusResult.firstOutputMs.toFixed(2)}ms`);
  console.log(`  Total time: ${statusResult.totalMs.toFixed(2)}ms\n`);

  // Save results
  const reportsDir = join(rootDir, 'reports');
  try {
    mkdirSync(reportsDir, { recursive: true });
  } catch {}

  const outputPath = join(reportsDir, 'cold-start-before.json');
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Results saved to: ${outputPath}`);

  return results;
}

main().catch(console.error);
