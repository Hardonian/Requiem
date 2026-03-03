import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const BANNED_PATTERNS = [
  {
    regex: /\bmagic\b/i,
    message: 'Avoid "magic". Use technical descriptions (e.g., "deterministic hashing").'
  },
  {
    regex: /\bperfectly\b/i,
    message: 'Avoid "perfectly". Use specific performance/invariant metrics.'
  },
  {
    regex: /\bSOC\s*2\b(?!\s*(?:Type\s+[IV]+|readiness|audits|compliance|Compliance\s+Controls|requirements|designed\s+to\s+support|CC[0-9]))/i,
    message: 'Claims of "SOC 2" must specify "designed to support", "Compliance Controls", "audits", "readiness", or a specific criteria (e.g., CC6.1).'
  },
  {
    regex: /\babsolute\s+security\b/i,
    message: 'No such thing as "absolute security". Use "verified isolation" or "cryptographic proof".'
  },
  {
    regex: /\bguaranteed\b(?!\s*by\s+(?:verification|validation|test|invariant|gate|default|\[test\/command\]))/i,
    message: 'Claims must be "verified by [test/command]", not "guaranteed".'
  }
];

const SCAN_DIRS = ['docs', 'private/procurement', 'private/rfp'];
const SCAN_FILES = ['README.md'];

function scanFile(filePath: string) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let issues = 0;

  lines.forEach((line, index) => {
    BANNED_PATTERNS.forEach(pattern => {
      if (pattern.regex.test(line)) {
        console.warn(`[LINT] ${filePath}:${index + 1}: ${pattern.message}`);
        console.warn(`  > ${line.trim()}`);
        issues++;
      }
    });
  });

  return issues;
}

function walkDir(dir: string): string[] {
  let results: string[] = [];
  const list = readdirSync(dir);
  list.forEach(file => {
    file = join(dir, file);
    const stat = statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(file));
    } else {
      if (['.md', '.txt'].includes(extname(file))) {
        results.push(file);
      }
    }
  });
  return results;
}

let totalIssues = 0;

console.log('--- Claims Linter (Aspirational Claims Check) ---');

const filesToScan = [...SCAN_FILES];
SCAN_DIRS.forEach(dir => {
  try {
    filesToScan.push(...walkDir(join(process.cwd(), dir)));
  } catch (e) {
    // Skip if dir doesn't exist
  }
});

filesToScan.forEach(file => {
  totalIssues += scanFile(file);
});

if (totalIssues > 0) {
  console.error(`\n❌ Claims linter failed with ${totalIssues} issues.`);
  // process.exit(1); // Set to non-zero if we want to enforce strictly in CI
} else {
  console.log('\n✅ Claims linter passed.');
}
