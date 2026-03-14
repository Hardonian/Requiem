#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { generateRouteManifest } from './lib/route-manifest';

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, 'routes.manifest.json');

const manifest = generateRouteManifest(repoRoot);
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`generated ${path.relative(repoRoot, manifestPath)} (${manifest.routes.length} routes)`);
