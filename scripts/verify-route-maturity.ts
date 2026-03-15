#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const NAV_FILE = path.join(ROOT, 'ready-layer/src/components/ConsoleNavigation.tsx');
const DOC_FILE = path.join(ROOT, 'docs/reference/ROUTE_MATURITY.md');

async function main(): Promise<void> {
  const { CONSOLE_NAV_ENTRIES } = await import(pathToFileURL(path.join(ROOT, 'ready-layer/src/lib/console-navigation.ts')).href);
  const { ROUTE_MATURITY_RULES, applyNavLabelPolicy } = await import(pathToFileURL(path.join(ROOT, 'ready-layer/src/lib/route-maturity.ts')).href);

  const maturityToNote: Record<string, string | undefined> = {
    demo: 'maturity="demo"',
    informational: 'maturity="informational"',
    'runtime-degraded': 'maturity="runtime-degraded"',
  };

  const errors: string[] = [];
  const seenRoutes = new Set<string>();

  for (const rule of ROUTE_MATURITY_RULES) {
    if (seenRoutes.has(rule.route)) {
      errors.push(`Duplicate maturity rule for ${rule.route}`);
      continue;
    }
    seenRoutes.add(rule.route);

    const fullPagePath = path.join(ROOT, rule.pageFile);
    if (!fs.existsSync(fullPagePath)) {
      errors.push(`Missing page file for ${rule.route}: ${rule.pageFile}`);
      continue;
    }

    const source = fs.readFileSync(fullPagePath, 'utf8');
    if (rule.disclosureRequirement === 'required-banner') {
      if (!source.includes('RouteMaturityNote')) {
        errors.push(`${rule.route}: disclosure required but RouteMaturityNote not found`);
      }
      const expectedMaturityTag = maturityToNote[rule.maturity];
      if (expectedMaturityTag && !source.includes(expectedMaturityTag)) {
        errors.push(`${rule.route}: expected RouteMaturityNote with ${expectedMaturityTag} in ${rule.pageFile}`);
      }
    }
  }

  const navSource = fs.readFileSync(NAV_FILE, 'utf8');
  const navLabelByRoute = new Map<string, string>();

  if (!navSource.includes('applyNavLabelPolicy') || !navSource.includes('getRouteMaturityRule')) {
    errors.push('ConsoleNavigation must derive labels from route maturity policy helpers');
  }

  for (const entry of CONSOLE_NAV_ENTRIES) {
    const rule = ROUTE_MATURITY_RULES.find((candidate: { route: string }) => candidate.route === entry.href);
    if (!rule || !rule.navEligible) continue;

    if (entry.baseLabel.includes('(')) {
      errors.push(`Console nav base label for ${entry.href} must not inline maturity suffixes`);
    }

    const expectedLabel = applyNavLabelPolicy(entry.baseLabel, rule.navLabelPolicy);
    navLabelByRoute.set(entry.href, expectedLabel);
  }

  const docSource = fs.readFileSync(DOC_FILE, 'utf8');
  if (!docSource.includes('ready-layer/src/lib/route-maturity.ts')) {
    errors.push('docs/reference/ROUTE_MATURITY.md must reference ready-layer/src/lib/route-maturity.ts as canonical source');
  }

  if (errors.length > 0) {
    console.error('Route maturity verification failed:');
    errors.forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }

  console.log(`verify-route-maturity passed (${ROUTE_MATURITY_RULES.length} canonical rules, ${navLabelByRoute.size} nav policy checks)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
