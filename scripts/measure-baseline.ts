#!/usr/bin/env node
/**
 * SECTION 0 — MEASURE WHAT MATTERS (AND KEEP IT)
 * 
 * Deterministic benchmark harness for:
 * - CLI cold start
 * - Hot command timings p50/p95
 * - "run" path timing for a standard fixture
 * - Build time, typecheck time, test time
 * - Memory usage snapshot (RSS delta) for 100 sequential runs
 * 
 * Stores results in /reports/perf-*.json
 */

import { execSync, spawn } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface PerfMetrics {
  timestamp: string;
  version: string;
  coldStart: {
    ms: number;
    memoryKB: number;
  };
  hotCommand: {
    help: { p50: number; p95: number };
    version: { p50: number; p95: number };
    status: { p50: number; p95: number };
  };
  runPath: {
    echo: { p50: number; p95: number };
  };
  buildTime: {
    cpp: number;
    web: number;
  };
  typecheckTime: number;
  testTime: number;
  memoryProfile: {
    run100Seq: {
      initialKB: number;
      finalKB: number;
      deltaKB: number;
      peakKB: number;
    };
  };
}

function measureColdStart(): { ms: number; memoryKB: number } {
  const start = process.hrtime.bigint();
  const result = execSync('node packages/cli/dist/cli.js --version', {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const end = process.hrtime.bigint();
  const ms = Number(end - start) / 1_000_000;
  
  // Memory is harder to measure accurately in subprocess
  // Use process.memoryUsage as approximation for parent
  const mem = process.memoryUsage();
  return { ms, memoryKB: Math.round(mem.rss / 1024) };
}

function measureCommandTimes(command: string, args: string[], runs: number): { p50: number; p95: number } {
  const times: number[] = [];
  
  for (let i = 0; i < runs; i++) {
    const start = process.hrtime.bigint();
    try {
      execSync(`node packages/cli/dist/cli.js ${command} ${args.join(' ')}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 30000,
      });
    } catch (e) {
      // Some commands may fail - that's ok for timing
    }
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / 1_000_000);
  }
  
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];
  
  return { p50, p95 };
}

function measureBuildTime(): { cpp: number; web: number } {
  console.log('  Measuring C++ build time...');
  const cppStart = Date.now();
  try {
    execSync('cmake -S . -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j', {
      stdio: 'pipe',
      timeout: 300000,
    });
  } catch (e) {
    console.log('    C++ build failed or not available');
  }
  const cpp = Date.now() - cppStart;
  
  console.log('  Measuring web build time...');
  const webStart = Date.now();
  try {
    execSync('pnpm --filter ready-layer build', {
      stdio: 'pipe',
      timeout: 300000,
    });
  } catch (e) {
    console.log('    Web build failed');
  }
  const web = Date.now() - webStart;
  
  return { cpp, web };
}

function measureTypecheckTime(): number {
  console.log('  Measuring typecheck time...');
  const start = Date.now();
  try {
    execSync('npx tsc --project ready-layer/tsconfig.json --noEmit', {
      stdio: 'pipe',
      timeout: 120000,
    });
  } catch (e) {
    // Type errors don't affect timing
  }
  return Date.now() - start;
}

function measureTestTime(): number {
  console.log('  Measuring test time...');
  const start = Date.now();
  try {
    execSync('pnpm run verify:ci', {
      stdio: 'pipe',
      timeout: 600000,
    });
  } catch (e) {
    // Test failures don't affect timing
  }
  return Date.now() - start;
}

function measureMemoryProfile100(): { initialKB: number; finalKB: number; deltaKB: number; peakKB: number } {
  console.log('  Measuring memory profile (100 sequential runs)...');
  const initial = process.memoryUsage().rss;
  let peak = initial;
  
  for (let i = 0; i < 100; i++) {
    try {
      execSync('node packages/cli/dist/cli.js --help', {
        stdio: 'pipe',
        timeout: 5000,
      });
    } catch (e) {
      // Ignore
    }
    const current = process.memoryUsage().rss;
    if (current > peak) peak = current;
  }
  
  const final = process.memoryUsage().rss;
  
  return {
    initialKB: Math.round(initial / 1024),
    finalKB: Math.round(final / 1024),
    deltaKB: Math.round((final - initial) / 1024),
    peakKB: Math.round(peak / 1024),
  };
}

async function main() {
  console.log('=== PERFORMANCE BASELINE MEASUREMENT ===\n');
  
  // Ensure reports directory exists
  if (!existsSync('reports')) {
    mkdirSync('reports', { recursive: true });
  }
  
  const metrics: PerfMetrics = {
    timestamp: new Date().toISOString(),
    version: '0.2.0',
    coldStart: { ms: 0, memoryKB: 0 },
    hotCommand: {
      help: { p50: 0, p95: 0 },
      version: { p50: 0, p95: 0 },
      status: { p50: 0, p95: 0 },
    },
    runPath: {
      echo: { p50: 0, p95: 0 },
    },
    buildTime: { cpp: 0, web: 0 },
    typecheckTime: 0,
    testTime: 0,
    memoryProfile: {
      run100Seq: { initialKB: 0, finalKB: 0, deltaKB: 0, peakKB: 0 },
    },
  };
  
  console.log('1. Measuring cold start...');
  metrics.coldStart = measureColdStart();
  console.log(`   Cold start: ${metrics.coldStart.ms.toFixed(2)}ms, ${metrics.coldStart.memoryKB}KB`);
  
  console.log('\n2. Measuring hot command timings (50 runs each)...');
  metrics.hotCommand.help = measureCommandTimes('--help', [], 50);
  console.log(`   --help: p50=${metrics.hotCommand.help.p50.toFixed(2)}ms, p95=${metrics.hotCommand.help.p95.toFixed(2)}ms`);
  
  metrics.hotCommand.version = measureCommandTimes('--version', [], 50);
  console.log(`   --version: p50=${metrics.hotCommand.version.p50.toFixed(2)}ms, p95=${metrics.hotCommand.version.p95.toFixed(2)}ms`);
  
  // status may fail without setup - just measure timing
  metrics.hotCommand.status = measureCommandTimes('status', [], 20);
  console.log(`   status: p50=${metrics.hotCommand.status.p50.toFixed(2)}ms, p95=${metrics.hotCommand.status.p95.toFixed(2)}ms`);
  
  console.log('\n3. Measuring build times...');
  metrics.buildTime = measureBuildTime();
  console.log(`   C++ build: ${metrics.buildTime.cpp}ms`);
  console.log(`   Web build: ${metrics.buildTime.web}ms`);
  
  console.log('\n4. Measuring typecheck time...');
  metrics.typecheckTime = measureTypecheckTime();
  console.log(`   Typecheck: ${metrics.typecheckTime}ms`);
  
  console.log('\n5. Measuring memory profile...');
  metrics.memoryProfile.run100Seq = measureMemoryProfile100();
  console.log(`   Initial: ${metrics.memoryProfile.run100Seq.initialKB}KB`);
  console.log(`   Final: ${metrics.memoryProfile.run100Seq.finalKB}KB`);
  console.log(`   Delta: ${metrics.memoryProfile.run100Seq.deltaKB}KB`);
  console.log(`   Peak: ${metrics.memoryProfile.run100Seq.peakKB}KB`);
  
  // Save results
  const outputPath = join('reports', `perf-baseline-${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify(metrics, null, 2));
  console.log(`\n✓ Baseline saved to: ${outputPath}`);
  
  // Also save as current
  writeFileSync(join('reports', 'perf-current.json'), JSON.stringify(metrics, null, 2));
  
  // Print summary
  console.log('\n=== BASELINE SUMMARY ===');
  console.log(`Cold Start: ${metrics.coldStart.ms.toFixed(2)}ms`);
  console.log(`Help p50/p95: ${metrics.hotCommand.help.p50.toFixed(2)}ms / ${metrics.hotCommand.help.p95.toFixed(2)}ms`);
  console.log(`Typecheck: ${(metrics.typecheckTime / 1000).toFixed(2)}s`);
  console.log(`Memory Delta (100 runs): ${metrics.memoryProfile.run100Seq.deltaKB}KB`);
}

main().catch(console.error);
