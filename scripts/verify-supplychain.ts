/**
 * Supply Chain Verification Suite
 *
 * Logic ported from scripts/verify_supplychain.sh to TS for cross-platform reliability.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const SBOM_FILE = path.join(REPO_ROOT, 'artifacts', 'reports', 'sbom.json');
const ALLOWLIST_FILE = path.join(REPO_ROOT, 'contracts', 'deps.allowlist.json');
const CHECKSUM_FILE = path.join(REPO_ROOT, 'artifacts', 'reports', 'binary_checksum.json');
const THIRD_PARTY_DIR = path.join(REPO_ROOT, 'third_party');

function runVerification() {
  console.log('🛡️  Supply Chain Verification...\n');
  let violations = 0;
  let warnings = 0;

  // 1. SBOM Presence and Structure
  if (!fs.existsSync(SBOM_FILE)) {
    console.error('❌ FAIL: SBOM not found at ' + SBOM_FILE);
    violations++;
  } else {
    try {
      const sbom = JSON.parse(fs.readFileSync(SBOM_FILE, 'utf-8'));
      if (sbom.bomFormat !== 'CycloneDX') {
        console.error('❌ FAIL: Expected CycloneDX format, got ' + sbom.bomFormat);
        violations++;
      } else {
        console.log('✅ OK: SBOM format is CycloneDX (' + sbom.specVersion + ')');
      }
    } catch (e) {
      console.error('❌ FAIL: SBOM is not valid JSON');
      violations++;
    }
  }

  // 2. Allowlist Cross-check
  if (fs.existsSync(SBOM_FILE) && fs.existsSync(ALLOWLIST_FILE)) {
    const sbom = JSON.parse(fs.readFileSync(SBOM_FILE, 'utf-8'));
    const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_FILE, 'utf-8'));

    const allowedNames = new Set<string>();
    for (const section of ['cpp_vendored', 'node_runtime']) {
      for (const dep of (allowlist[section] || [])) {
        allowedNames.add(dep.name);
      }
    }

    const components = sbom.components || [];
    for (const comp of components) {
      if (comp.name && !allowedNames.has(comp.name)) {
        // Many Node deps are added by SBOM generator, we might just warn or filter them.
        // For now, let's focus on C++ third_party.
        if (comp.type === 'library' && comp.name.startsWith('@requiem/')) continue;
        console.warn('⚠️  WARN: SBOM component "' + comp.name + '" not in allowlist');
        warnings++;
      }
    }
  }

  // 3. Binary Checksum Presence
  if (!fs.existsSync(CHECKSUM_FILE)) {
    console.warn('⚠️  WARN: Binary checksum file missing (expected on build)');
    warnings++;
  } else {
    console.log('✅ OK: Binary checksum artifact present');
  }

  // 4. Third-party Licenses
  if (fs.existsSync(THIRD_PARTY_DIR)) {
    const libs = fs.readdirSync(THIRD_PARTY_DIR);
    for (const lib of libs) {
      const libPath = path.join(THIRD_PARTY_DIR, lib);
      if (fs.statSync(libPath).isDirectory()) {
         const files = fs.readdirSync(libPath);
         const hasLicense = files.some(f => /license|copying/i.test(f));
         if (!hasLicense) {
           console.error('❌ FAIL: third_party/' + lib + ' has no LICENSE file');
           violations++;
         }
      }
    }
  }

  console.log('\nSummary: ' + violations + ' violations, ' + warnings + ' warnings');
  process.exit(violations > 0 ? 1 : 0);
}

runVerification();
