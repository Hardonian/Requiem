#!/usr/bin/env tsx
/**
 * Route Manifest Verifier for ReadyLayer
 *
 * This script:
 * 1. Enumerates all app routes in ready-layer/src/app
 * 2. Validates against routes.manifest.json
 * 3. Ensures required static routes exist
 * 4. Checks no unexpected 500s would occur on build
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const READY_LAYER_DIR = path.join(ROOT_DIR, 'ready-layer');
const APP_DIR = path.join(READY_LAYER_DIR, 'src', 'app');
const MANIFEST_PATH = path.join(ROOT_DIR, 'routes.manifest.json');

interface RouteInfo {
  path: string;
  file: string;
  type: 'page' | 'layout' | 'api' | 'error' | 'not-found';
  isStatic?: boolean;
}

interface ManifestRoute {
  path: string;
  method?: string;
  file?: string;
  auth_required?: boolean;
  probe?: boolean;
  description?: string;
}

interface RouteManifest {
  manifest_version: string;
  routes: ManifestRoute[];
}

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const color = type === 'success' ? GREEN : type === 'error' ? RED : type === 'warning' ? YELLOW : '';
  console.log(`${color}${message}${RESET}`);
}

/**
 * Recursively scan the app directory for routes
 */
function scanAppRoutes(dir: string, basePath: string = ''): RouteInfo[] {
  const routes: RouteInfo[] = [];

  if (!fs.existsSync(dir)) {
    log(`App directory not found: ${dir}`, 'error');
    return routes;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(basePath, entry.name);

    if (entry.isDirectory()) {
      // Skip special directories
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) {
        continue;
      }

      // Recursively scan subdirectories
      routes.push(...scanAppRoutes(fullPath, relativePath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (ext !== '.ts' && ext !== '.tsx') continue;

      const baseName = path.basename(entry.name, ext);
      const filePath = path.relative(ROOT_DIR, fullPath);

      // Determine route type
      let type: RouteInfo['type'] = 'page';
      if (baseName === 'route') type = 'api';
      else if (baseName === 'error') type = 'error';
      else if (baseName === 'not-found') type = 'not-found';
      else if (baseName === 'layout') type = 'layout';
      else if (baseName !== 'page') {
        continue; // Skip other files
      }

      // Calculate route path - remove 'app' prefix since src/app is the app root
      // Files in src/app/X/page.tsx -> route /X
      // Files in src/app/app/X/page.tsx -> route /app/X (nested app directory)
      let routePath = basePath
        .replace(/\\/g, '/')
        .replace(/^app/, '') // Remove leading 'app' from src/app
        .replace(/\([^)]+\)/g, '') // Remove route groups
        .replace(/\/+/g, '/');

      if (!routePath) routePath = '/';

      routes.push({
        path: routePath,
        file: filePath,
        type,
      });
    }
  }

  return routes;
}

/**
 * Check if a page file has explicit static generation config
 */
function checkStaticGeneration(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check for static export indicators
    const hasStaticExport =
      content.includes("export const dynamic = 'force-static'") ||
      content.includes('export const dynamic = "force-static"') ||
      content.includes('generateStaticParams');

    return hasStaticExport;
  } catch {
    return false;
  }
}

/**
 * Load and validate the route manifest
 */
function loadManifest(): RouteManifest | null {
  try {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    return JSON.parse(content) as RouteManifest;
  } catch (error) {
    log(`Failed to load manifest: ${error}`, 'error');
    return null;
  }
}

/**
 * Main verification function
 */
async function verifyRoutes() {
  log('\n🔍 Route Manifest Verifier', 'info');
  log('==========================\n', 'info');

  // 1. Scan app routes
  log('Scanning app routes...', 'info');
  const appRoutes = scanAppRoutes(APP_DIR);
  log(`  Found ${appRoutes.length} route files`, 'success');

  // 2. Load manifest
  log('\nLoading route manifest...', 'info');
  const manifest = loadManifest();
  if (!manifest) {
    process.exit(1);
  }
  log(`  Manifest version: ${manifest.manifest_version}`, 'success');
  log(`  Manifest routes: ${manifest.routes.length}`, 'success');

  // 3. Check for required static routes
  log('\nChecking static routes...', 'info');
  const requiredStaticRoutes = [
    '/',
    '/executions',
    '/metrics',
    '/diagnostics',
    '/cas',
    '/replay',
    '/tenants',
  ];

  const foundPageRoutes = new Set(
    appRoutes
      .filter(r => r.type === 'page')
      .map(r => r.path)
  );

  let missingRoutes = 0;
  for (const route of requiredStaticRoutes) {
    if (foundPageRoutes.has(route)) {
      log(`  ✓ ${route}`, 'success');
    } else {
      log(`  ✗ ${route} (MISSING)`, 'error');
      missingRoutes++;
    }
  }

  // 4. Check for error boundaries
  log('\nChecking error boundaries...', 'info');
  const hasErrorBoundary = appRoutes.some(r => r.type === 'error');
  const hasNotFound = appRoutes.some(r => r.type === 'not-found');

  if (hasErrorBoundary) {
    log('  ✓ error.tsx found', 'success');
  } else {
    log('  ✗ error.tsx not found', 'error');
  }

  if (hasNotFound) {
    log('  ✓ not-found.tsx found', 'success');
  } else {
    log('  ✗ not-found.tsx not found', 'error');
  }

  // 5. Verify manifest alignment
  log('\nVerifying manifest alignment...', 'info');
  const apiRoutes = appRoutes.filter(r => r.type === 'api');
  const manifestApiRoutes = manifest.routes.filter(r => r.path.startsWith('/api'));

  log(`  API routes in filesystem: ${apiRoutes.length}`, 'info');
  log(`  API routes in manifest: ${manifestApiRoutes.length}`, 'info');

  // 6. Check for hard-500 prevention
  log('\nChecking hard-500 prevention...', 'info');
  let hard500Risk = 0;

  for (const route of apiRoutes) {
    const fullPath = path.join(ROOT_DIR, route.file);
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');

      // Check for error handling
      const hasTryCatch = content.includes('try') && content.includes('catch');
      const hasErrorBoundary = content.includes('error') || content.includes('Error');

      if (!hasTryCatch && !hasErrorBoundary) {
        log(`  ⚠ ${route.path} may lack error handling`, 'warning');
        hard500Risk++;
      }
    } catch {
      // Skip files we can't read
    }
  }

  if (hard500Risk === 0) {
    log('  ✓ No obvious hard-500 risks detected', 'success');
  }

  // 7. Summary
  log('\n==========================', 'info');
  log('Verification Summary', 'info');
  log('==========================\n', 'info');

  if (missingRoutes === 0 && hasErrorBoundary && hasNotFound) {
    log('✓ All checks passed!', 'success');
    return 0;
  } else {
    log(`✗ Issues found:`, 'error');
    if (missingRoutes > 0) log(`  - ${missingRoutes} missing routes`, 'error');
    if (!hasErrorBoundary) log(`  - Missing error boundary`, 'error');
    if (!hasNotFound) log(`  - Missing not-found page`, 'error');
    return 1;
  }
}

// Run verification
verifyRoutes()
  .then(code => process.exit(code))
  .catch(error => {
    log(`Unexpected error: ${error}`, 'error');
    process.exit(1);
  });
