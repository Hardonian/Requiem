/**
 * SBOM Generator
 *
 * Generates artifacts/reports/sbom.json in CycloneDX format.
 * Includes both Node (pnpm) and C++ (vendored) components.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(REPO_ROOT, 'artifacts', 'reports', 'sbom.json');
const ALLOWLIST_FILE = path.join(REPO_ROOT, 'contracts', 'deps.allowlist.json');

function generateSBOM() {
  console.log('📦 Generating SBOM...');

  const timestamp = new Date().toISOString();
  const sbom: any = {
    bomFormat: 'CycloneDX',
    specVersion: '1.4',
    serialNumber: `urn:uuid:${Math.random().toString(36).substring(2)}-${Date.now()}`,
    version: 1,
    metadata: {
      timestamp,
      component: {
        name: 'Requiem',
        version: '0.2.0',
        type: 'application'
      }
    },
    components: []
  };

  // 1. Add Node.js dependencies (from pnpm)
  try {
    const pnpmOutput = execSync('pnpm licenses list --json', { encoding: 'utf-8' });
    const pnpmDeps = JSON.parse(pnpmOutput);

    for (const [name, versionInfo] of Object.entries(pnpmDeps)) {
      const info: any = versionInfo;
      sbom.components.push({
        name,
        version: info.version || 'unknown',
        type: 'library',
        licenses: (info.license ? [{ license: { id: info.license } }] : [])
      });
    }
  } catch (e) {
    console.warn('⚠️  Could not run pnpm licenses list. Stubbing Node deps.');
  }

  // 2. Add C++ vendored dependencies (from allowlist)
  if (fs.existsSync(ALLOWLIST_FILE)) {
    const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_FILE, 'utf-8'));
    const vendored = allowlist.cpp_vendored || [];

    for (const dep of vendored) {
      sbom.components.push({
        name: dep.name,
        version: dep.version || 'vendored',
        type: 'library',
        licenses: (dep.license ? [{ license: { id: dep.license } }] : [])
      });
    }
  }

  // Ensure artifacts/reports directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(sbom, null, 2));
  console.log(`✅ SBOM generated at: ${OUTPUT_FILE}`);
}

generateSBOM();
