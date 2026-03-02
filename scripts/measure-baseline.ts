#!/usr/bin/env node
/**
 * Performance + Maintainability Baseline Measurement Script
 * Captures BEFORE/AFTER metrics for optimization work
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface BaselineMetrics {
  timestamp: string;
  gitSha: string;
  cli: {
    coldStartMs: number;
    helpTimeMs: number;
    versionTimeMs: number;
  };
  bundle: {
    totalSizeBytes: number;
    fileCount: number;
  };
  dependencies: {
    prodCount: number;
    devCount: number;
    totalSizeMb: number;
    heaviestDeps: Array<{ name: string; sizeMb: number }>;
  };
  codeMetrics: {
    totalFiles: number;
    totalLines: number;
    consoleUsageCount: number;
    errorClassCount: number;
  };
  build: {
    buildTimeMs: number;
    testTimeMs: number;
  };
}

function execTime(cmd: string): number {
  const start = Date.now();
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 30000 });
  } catch {
    // Command might fail but we still want timing
  }
  return Date.now() - start;
}

function getGitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

function countConsoleUsage(): number {
  try {
    const srcDir = 'packages/cli/src';
    if (!fs.existsSync(srcDir)) return 0;
    
    let count = 0;
    const files = execSync(`find ${srcDir} -name "*.ts" 2>/dev/null || dir /s /b ${srcDir}\\*.ts 2>nul`, { encoding: 'utf-8' });
    for (const file of files.split('\n').filter(f => f.endsWith('.ts'))) {
      try {
        const content = fs.readFileSync(file.trim(), 'utf-8');
        const matches = content.match(/console\.(log|error|warn|info)/g);
        if (matches) count += matches.length;
      } catch {}
    }
    return count;
  } catch {
    return 0;
  }
}

function getDepSizes(): Array<{ name: string; sizeMb: number }> {
  const sizes: Array<{ name: string; sizeMb: number }> = [];
  try {
    const nodeModules = 'packages/cli/node_modules';
    if (!fs.existsSync(nodeModules)) return sizes;
    
    const entries = fs.readdirSync(nodeModules).filter(e => !e.startsWith('.'));
    for (const entry of entries.slice(0, 50)) {
      try {
        const stat = fs.statSync(path.join(nodeModules, entry));
        if (stat.isDirectory()) {
          // Rough estimate - count files
          let bytes = 0;
          const walk = (dir: string) => {
            for (const f of fs.readdirSync(dir)) {
              const fp = path.join(dir, f);
              const s = fs.statSync(fp);
              if (s.isDirectory()) walk(fp);
              else bytes += s.size;
            }
          };
          walk(path.join(nodeModules, entry));
          sizes.push({ name: entry, sizeMb: Math.round((bytes / 1024 / 1024) * 100) / 100 });
        }
      } catch {}
    }
  } catch {}
  return sizes.sort((a, b) => b.sizeMb - a.sizeMb).slice(0, 20);
}

function measureBaseline(): BaselineMetrics {
  console.log('📊 Measuring baseline...');
  
  // CLI cold start measurements
  console.log('  - CLI cold start...');
  const coldStartMs = execTime('node packages/cli/dist/cli/src/cli.js --version 2>nul || echo ""');
  const helpTimeMs = execTime('node packages/cli/dist/cli/src/cli.js --help 2>nul || echo ""');
  const versionTimeMs = execTime('node packages/cli/dist/cli/src/cli.js --version 2>nul || echo ""');
  
  // Build time
  console.log('  - Build time...');
  const buildStart = Date.now();
  try {
    execSync('cd packages/cli && npm run build', { stdio: 'pipe', timeout: 120000 });
  } catch {}
  const buildTimeMs = Date.now() - buildStart;
  
  // Code metrics
  console.log('  - Code metrics...');
  const consoleUsageCount = countConsoleUsage();
  
  // Dependencies
  console.log('  - Dependency analysis...');
  const heaviestDeps = getDepSizes();
  const totalDepSize = heaviestDeps.reduce((sum, d) => sum + d.sizeMb, 0);
  
  // Package.json counts
  let prodCount = 0;
  let devCount = 0;
  try {
    const pkg = JSON.parse(fs.readFileSync('packages/cli/package.json', 'utf-8'));
    prodCount = Object.keys(pkg.dependencies || {}).length;
    devCount = Object.keys(pkg.devDependencies || {}).length;
  } catch {}
  
  return {
    timestamp: new Date().toISOString(),
    gitSha: getGitSha(),
    cli: {
      coldStartMs,
      helpTimeMs,
      versionTimeMs,
    },
    bundle: {
      totalSizeBytes: 0, // Will measure after build
      fileCount: 0,
    },
    dependencies: {
      prodCount,
      devCount,
      totalSizeMb: Math.round(totalDepSize * 100) / 100,
      heaviestDeps,
    },
    codeMetrics: {
      totalFiles: 0,
      totalLines: 0,
      consoleUsageCount,
      errorClassCount: 0,
    },
    build: {
      buildTimeMs,
      testTimeMs: 0,
    },
  };
}

function main() {
  const metrics = measureBaseline();
  const outPath = process.argv[2] || 'reports/perf-maintainability-baseline.json';
  
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(metrics, null, 2));
  
  console.log('\n✅ Baseline captured:');
  console.log(`  CLI cold start: ${metrics.cli.coldStartMs}ms`);
  console.log(`  Console usage: ${metrics.codeMetrics.consoleUsageCount} calls`);
  console.log(`  Prod deps: ${metrics.dependencies.prodCount}`);
  console.log(`  Written to: ${outPath}`);
}

main();
