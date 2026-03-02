#!/usr/bin/env node
/**
 * Cold Start Profiler After Optimization - Measure CLI startup latency
 */

import { performance } from 'node:perf_hooks';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
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
  console.log('=== Cold Start Profiling After Optimization ===\n');

  // Read previous results
  let beforeResults = null;
  try {
    const beforeData = readFileSync(join(rootDir, 'reports/cold-start-before.json'), 'utf-8');
    beforeResults = JSON.parse(beforeData);
  } catch {}

  const results = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    measurements: []
  };

  // Warm up
  console.log('Warming up...');
  await measureColdStart('--help');

  // Measure help (fast path)
  console.log('Measuring: reach --help (FAST PATH - no heavy imports)');
  const helpResult = await measureColdStart('--help');
  results.measurements.push(helpResult);
  console.log(`  First output: ${helpResult.firstOutputMs.toFixed(2)}ms`);
  console.log(`  Total time: ${helpResult.totalMs.toFixed(2)}ms`);
  if (beforeResults) {
    const before = beforeResults.measurements.find(m => m.command === '--help');
    if (before) {
      const delta = helpResult.firstOutputMs - before.firstOutputMs;
      const pct = ((delta / before.firstOutputMs) * 100).toFixed(1);
      console.log(`  Delta: ${delta > 0 ? '+' : ''}${delta.toFixed(2)}ms (${pct}%)`);
    }
  }
  console.log();

  // Measure version (fast path)
  console.log('Measuring: reach version (FAST PATH - no heavy imports)');
  const versionResult = await measureColdStart('version');
  results.measurements.push(versionResult);
  console.log(`  First output: ${versionResult.firstOutputMs.toFixed(2)}ms`);
  console.log(`  Total time: ${versionResult.totalMs.toFixed(2)}ms`);
  if (beforeResults) {
    const before = beforeResults.measurements.find(m => m.command === 'version');
    if (before) {
      const delta = versionResult.firstOutputMs - before.firstOutputMs;
      const pct = ((delta / before.firstOutputMs) * 100).toFixed(1);
      console.log(`  Delta: ${delta > 0 ? '+' : ''}${delta.toFixed(2)}ms (${pct}%)`);
    }
  }
  console.log();

  // Measure status (requires DB - should be slower)
  console.log('Measuring: reach status (loads DB)');
  const statusResult = await measureColdStart('status');
  results.measurements.push(statusResult);
  console.log(`  First output: ${statusResult.firstOutputMs.toFixed(2)}ms`);
  console.log(`  Total time: ${statusResult.totalMs.toFixed(2)}ms`);
  if (beforeResults) {
    const before = beforeResults.measurements.find(m => m.command === 'status');
    if (before) {
      const delta = statusResult.firstOutputMs - before.firstOutputMs;
      const pct = ((delta / before.firstOutputMs) * 100).toFixed(1);
      console.log(`  Delta: ${delta > 0 ? '+' : ''}${delta.toFixed(2)}ms (${pct}%)`);
    }
  }
  console.log();

  // Save results
  const reportsDir = join(rootDir, 'reports');
  try {
    mkdirSync(reportsDir, { recursive: true });
  } catch {}

  const outputPath = join(reportsDir, 'cold-start-after.json');
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Results saved to: ${outputPath}`);

  // Generate delta report
  let deltaReport = '# Cold Start Optimization Results\n\n';
  deltaReport += `Date: ${new Date().toISOString()}\n\n`;
  deltaReport += '## Summary\n\n';
  deltaReport += '| Command | Before | After | Delta | Status |\n';
  deltaReport += '|---------|--------|-------|-------|--------|\n';
  
  if (beforeResults) {
    for (const m of results.measurements) {
      const before = beforeResults.measurements.find(b => b.command === m.command);
      if (before) {
        const delta = m.firstOutputMs - before.firstOutputMs;
        const pct = ((delta / before.firstOutputMs) * 100).toFixed(1);
        const status = delta <= 0 ? '✓ IMPROVED' : (delta < 5 ? '✓ NEUTRAL' : '✗ REGRESSION');
        deltaReport += `| ${m.command} | ${before.firstOutputMs.toFixed(2)}ms | ${m.firstOutputMs.toFixed(2)}ms | ${delta > 0 ? '+' : ''}${pct}% | ${status} |\n`;
      }
    }
  }
  
  deltaReport += '\n## Details\n\n';
  deltaReport += '- **help/version**: Fast path with zero heavy imports\n';
  deltaReport += '- **status**: Requires DB initialization (expected to be slower)\n';
  deltaReport += '- Goal: help/version < 20ms (Node.js baseline limit)\n';
  
  const deltaPath = join(reportsDir, 'cold-start-delta.md');
  writeFileSync(deltaPath, deltaReport);
  console.log(`Delta report saved to: ${deltaPath}`);

  return results;
}

main().catch(console.error);
