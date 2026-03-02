#!/usr/bin/env node
/**
 * SBOM Generator - Supply Chain Security
 * 
 * Generates Software Bill of Materials in SPDX and CycloneDX formats.
 * Runs in CI to verify dependencies.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';

interface SBOMPackage {
  name: string;
  version: string;
  type: 'npm' | 'cargo' | 'pip';
  license?: string;
  checksum?: string;
  purl?: string;
}

interface SBOM {
  schema: string;
  generated_at: string;
  packages: SBOMPackage[];
  total_packages: number;
  direct_dependencies: number;
}

const ROOT = resolve(process.cwd());

// ANSI colors
const G = '\x1b[32m';
const N = '\x1b[0m';

function log(msg: string) {
  console.log(msg);
}

function success(msg: string) {
  console.log(G + '✓ ' + msg + N);
}

// Parse npm packages
function getNPMPackages(): SBOMPackage[] {
  const packages: SBOMPackage[] = [];
  
  try {
    // Use npm ls to get dependency tree
    const output = execSync('npm ls --all --json', { 
      cwd: ROOT, 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const tree = JSON.parse(output);
    
    function traverseDeps(deps: Record<string, unknown>, path: string[] = []) {
      for (const [name, info] of Object.entries(deps)) {
        const dep = info as { version: string; dependencies?: Record<string, unknown> };
        if (dep.version) {
          packages.push({
            name,
            version: dep.version,
            type: 'npm',
            purl: `pkg:npm/${name}@${dep.version}`,
          });
        }
        if (dep.dependencies) {
          traverseDeps(dep.dependencies, [...path, name]);
        }
      }
    }
    
    if (tree.dependencies) {
      traverseDeps(tree.dependencies);
    }
  } catch {
    // npm ls exits with error if peer deps missing, but still outputs valid JSON
    try {
      const output = execSync('npm ls --all --json 2>/dev/null || true', { 
        cwd: ROOT, 
        encoding: 'utf-8',
        shell: true
      });
      const tree = JSON.parse(output);
      
      if (tree.dependencies) {
        for (const [name, info] of Object.entries(tree.dependencies)) {
          const dep = info as { version: string };
          if (dep.version) {
            packages.push({
              name,
              version: dep.version,
              type: 'npm',
              purl: `pkg:npm/${name}@${dep.version}`,
            });
          }
        }
      }
    } catch {
      // Fallback to package.json
      const pkgPath = join(ROOT, 'package.json');
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        for (const [name, version] of Object.entries(deps)) {
          packages.push({
            name,
            version: version as string,
            type: 'npm',
            purl: `pkg:npm/${name}@${version}`,
          });
        }
      }
    }
  }
  
  return packages;
}

// Get pnpm workspace packages
function getPnpmPackages(): SBOMPackage[] {
  const packages: SBOMPackage[] = [];
  
  try {
    const output = execSync('pnpm list --json', { 
      cwd: ROOT, 
      encoding: 'utf-8' 
    });
    const trees = JSON.parse(output);
    
    for (const tree of trees) {
      if (tree.dependencies) {
        for (const dep of tree.dependencies) {
          packages.push({
            name: dep.name,
            version: dep.version,
            type: 'npm',
            purl: `pkg:npm/${dep.name}@${dep.version}`,
          });
        }
      }
    }
  } catch {
    // Ignore errors
  }
  
  return packages;
}

// Deduplicate packages
function deduplicate(packages: SBOMPackage[]): SBOMPackage[] {
  const seen = new Set<string>();
  return packages.filter(pkg => {
    const key = `${pkg.name}@${pkg.version}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

// Generate SPDX format
function generateSPDX(packages: SBOMPackage[]): string {
  const timestamp = new Date().toISOString();
  let spdx = `SPDXVersion: SPDX-2.3
DataLicense: CC0-1.0
SPDXID: SPDXRef-DOCUMENT
DocumentName: Requiem SBOM
DocumentNamespace: https://requiem.hardonian.com/sbom
Created: ${timestamp}
Creator: Tool: requiem-sbom-generator-1.0

`;

  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i];
    spdx += `PackageName: ${pkg.name}
SPDXID: SPDXRef-Package-${i}
PackageVersion: ${pkg.version}
PackageDownloadLocation: NOASSERTION
FilesAnalyzed: false
PackageLicenseConcluded: NOASSERTION
PackageLicenseDeclared: NOASSERTION
PackageCopyrightText: NOASSERTION
ExternalRef: PACKAGE-MANAGER purl ${pkg.purl}

`;
  }

  return spdx;
}

// Generate CycloneDX format
function generateCycloneDX(packages: SBOMPackage[]): string {
  const bom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${generateUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        {
          vendor: 'Hardonian',
          name: 'requiem-sbom-generator',
          version: '1.0',
        },
      ],
    },
    components: packages.map(pkg => ({
      type: 'library',
      name: pkg.name,
      version: pkg.version,
      purl: pkg.purl,
    })),
  };

  return JSON.stringify(bom, null, 2);
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Main
function main(): number {
  log('\n=== SBOM Generation ===\n');

  // Collect packages
  const npmPackages = getNPMPackages();
  const pnpmPackages = getPnpmPackages();
  
  const allPackages = deduplicate([...npmPackages, ...pnpmPackages]);
  
  const sbom: SBOM = {
    schema: 'sbom_v1',
    generated_at: new Date().toISOString(),
    packages: allPackages,
    total_packages: allPackages.length,
    direct_dependencies: npmPackages.length,
  };

  // Ensure reports directory exists
  const reportsDir = join(ROOT, 'reports');
  if (!existsSync(reportsDir)) {
    writeFileSync(reportsDir, '');
  }

  // Write JSON SBOM
  const jsonPath = join(ROOT, 'reports', 'sbom.json');
  writeFileSync(jsonPath, JSON.stringify(sbom, null, 2));
  success(`Generated JSON SBOM: ${jsonPath}`);

  // Write SPDX SBOM
  const spdxPath = join(ROOT, 'reports', 'sbom.spdx');
  writeFileSync(spdxPath, generateSPDX(allPackages));
  success(`Generated SPDX SBOM: ${spdxPath}`);

  // Write CycloneDX SBOM
  const cyclonePath = join(ROOT, 'reports', 'sbom.cyclone.json');
  writeFileSync(cyclonePath, generateCycloneDX(allPackages));
  success(`Generated CycloneDX SBOM: ${cyclonePath}`);

  // Summary
  log('\n=== Summary ===');
  log(`Total packages: ${allPackages.length}`);
  log(`Direct dependencies: ${npmPackages.length}`);
  log(`Unique packages: ${allPackages.length}`);

  return 0;
}

process.exit(main());
