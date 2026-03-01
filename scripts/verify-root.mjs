#!/usr/bin/env node
/**
 * @fileoverview Root cleanliness verification script.
 *
 * Enforces repository hygiene by checking:
 * - No stray files in root
 * - No zip artifacts
 * - No dev-only scripts
 * - No commented secret blocks
 *
 * INVARIANT: CI fails if root cleanliness is violated.
 * INVARIANT: Root should only contain production-relevant files.
 *
 * Usage: node scripts/verify-root.mjs [--fix]
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

// Allowed root files (production + standard config)
const ALLOWED_FILES = new Set([
  // Config files
  '.editorconfig',
  '.gitignore',
  '.nvmrc',
  '.kilodemodes',
  'cspell.json',
  // Package management
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  // Documentation
  'README.md',
  'CHANGELOG.md',
  'LICENSE',
  'CODE_OF_CONDUCT.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  // Build configs
  'CMakeLists.txt',
  'next.config.js',
  'playwright.config.ts',
  'tsconfig.json',
  // Project metadata
  'decisions.csv',
  'routes.manifest.json',
  // Scripts (production)
  'scripts',
  // Directories
  'packages',
  'docs',
  'contracts',
  'flags',
  'eval',
  'e2e',
  'include',
  'formal',
  '.github',
  '.githooks',
  // Generated (acceptable in release branches)
  'init.ts',
]);

// Allowed extensions in root
const ALLOWED_EXTENSIONS = new Set([
  '.md',
  '.json',
  '.yaml',
  '.yml',
  '.csv',
  '.txt',
  '.config.js',
  '.config.ts',
]);

// Forbidden patterns (secrets, dev-only)
const FORBIDDEN_PATTERNS = [
  // Secret-like patterns
  /password\s*[=:]\s*["'][^"']+["']/i,
  /api[_-]?key\s*[=:]\s*["'][^"']+["']/i,
  /secret[_-]?key\s*[=:]\s*["'][^"']+["']/i,
  /token\s*[=:]\s*["'][a-zA-Z0-9_-]{20,}["']/i,
  /aws_access_key_id/i,
  /aws_secret_access_key/i,
  /private[_-]?key/i,
  // Dev-only markers in committed code
  /FIXME.*remove/i,
  /HACK.*production/i,
  /XXX.*debug/i,
];

// Forbidden file patterns
const FORBIDDEN_FILE_PATTERNS = [
  /\.zip$/i,
  /\.tar$/i,
  /\.gz$/i,
  /\.rar$/i,
  /\.7z$/i,
  /\.bak$/i,
  /\.tmp$/i,
  /\.temp$/i,
  /\.old$/i,
  /\.orig$/i,
  /\.swp$/i,
  /~$/,
  /^\.env/i,
  /secrets?\./i,
  /credentials?\./i,
  /local\./i,
  /\.local\./i,
];

// Dev-only script patterns (should not be in root)
const DEV_SCRIPT_PATTERNS = [
  /scratch/i,
  /debug/i,
  /test-local/i,
  /wip/i,
  /experiment/i,
];

const violations = [];

function addViolation(type, message, file = null) {
  violations.push({ type, message, file });
}

function checkRootFiles() {
  const entries = readdirSync(ROOT);

  for (const entry of entries) {
    // Skip hidden files except allowed ones
    if (entry.startsWith('.') && !ALLOWED_FILES.has(entry)) {
      // Check if it's a directory
      try {
        const stat = statSync(join(ROOT, entry));
        if (stat.isDirectory()) {
          addViolation('stray', `Hidden directory not in allowlist: ${entry}`);
        } else {
          addViolation('stray', `Hidden file not in allowlist: ${entry}`);
        }
      } catch {
        // Ignore errors
      }
      continue;
    }

    // Check if file is in allowlist
    if (!ALLOWED_FILES.has(entry)) {
      // Check extension
      const ext = extname(entry);
      let hasAllowedExt = false;
      for (const allowed of ALLOWED_EXTENSIONS) {
        if (entry.endsWith(allowed)) {
          hasAllowedExt = true;
          break;
        }
      }

      if (!hasAllowedExt) {
        addViolation('stray', `File not in allowlist: ${entry}`, entry);
      }
    }

    // Check forbidden file patterns
    for (const pattern of FORBIDDEN_FILE_PATTERNS) {
      if (pattern.test(entry)) {
        addViolation('artifact', `Forbidden file pattern: ${entry}`, entry);
      }
    }

    // Check dev-only script patterns
    if (entry.endsWith('.js') || entry.endsWith('.ts') || entry.endsWith('.mjs')) {
      for (const pattern of DEV_SCRIPT_PATTERNS) {
        if (pattern.test(entry)) {
          addViolation('dev-only', `Dev-only script in root: ${entry}`, entry);
        }
      }
    }
  }
}

function checkSecretBlocks() {
  const filesToCheck = [
    'package.json',
    'README.md',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
  ];

  for (const file of filesToCheck) {
    const filePath = join(ROOT, file);
    try {
      const content = readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.test(line)) {
            addViolation(
              'secret-block',
              `Potential secret or dev marker in ${file}:${i + 1}: ${line.trim().slice(0, 50)}...`,
              file
            );
          }
        }
      }
    } catch {
      // File doesn't exist, skip
    }
  }
}

function checkScriptsDirectory() {
  const scriptsDir = join(ROOT, 'scripts');
  try {
    const entries = readdirSync(scriptsDir);

    for (const entry of entries) {
      // Check for dev-only patterns in scripts
      for (const pattern of DEV_SCRIPT_PATTERNS) {
        if (pattern.test(entry)) {
          addViolation('dev-only', `Dev-only script in scripts/: ${entry}`, `scripts/${entry}`);
        }
      }

      // Check for zip artifacts
      for (const pattern of FORBIDDEN_FILE_PATTERNS) {
        if (pattern.test(entry)) {
          addViolation('artifact', `Artifact in scripts/: ${entry}`, `scripts/${entry}`);
        }
      }
    }
  } catch {
    // Scripts directory doesn't exist
  }
}

function printReport() {
  console.log('\n🔍 Root Cleanliness Verification Report\n');
  console.log('=' .repeat(50));

  if (violations.length === 0) {
    console.log('\n✅ All checks passed! Root is clean.');
    return 0;
  }

  // Group violations by type
  const byType = violations.reduce((acc, v) => {
    acc[v.type] = acc[v.type] || [];
    acc[v.type].push(v);
    return acc;
  }, {});

  for (const [type, items] of Object.entries(byType)) {
    console.log(`\n❌ ${type.toUpperCase()} (${items.length}):`);
    for (const item of items) {
      console.log(`   ${item.message}`);
    }
  }

  console.log(`\n⚠️  Total violations: ${violations.length}`);
  console.log('\nTo fix: Review and remove violations, or update ALLOWED_FILES if intentional.');

  return 1;
}

// Main
const shouldFix = process.argv.includes('--fix');

checkRootFiles();
checkSecretBlocks();
checkScriptsDirectory();

if (shouldFix && violations.length > 0) {
  console.log('\n📝 Auto-fix suggestions:');
  console.log('1. Remove stray files from root');
  console.log('2. Move dev scripts to dev/ or remove');
  console.log('3. Delete zip/artifact files');
  console.log('4. Remove or redact commented secrets');
}

process.exit(printReport());
