/**
 * Sitemap Generator - SEO Optimization
 *
 * Auto-generates sitemap.xml with all routes
 * Run during build: npx tsx src/lib/sitemap.ts
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

interface SitemapEntry {
  path: string;
  priority: number;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  lastmod?: string;
}

const BASE_URL = 'https://requiem.hardonian.com';

// Static routes with their priorities
const staticRoutes: SitemapEntry[] = [
  { path: '/', priority: 1.0, changefreq: 'daily' },
  { path: '/app/executions', priority: 0.9, changefreq: 'daily' },
  { path: '/security', priority: 0.8, changefreq: 'weekly' },
  { path: '/transparency', priority: 0.8, changefreq: 'weekly' },
  { path: '/pricing', priority: 0.8, changefreq: 'weekly' },
  { path: '/enterprise', priority: 0.7, changefreq: 'weekly' },
  { path: '/templates', priority: 0.7, changefreq: 'weekly' },
  { path: '/library', priority: 0.6, changefreq: 'weekly' },
  { path: '/support', priority: 0.6, changefreq: 'weekly' },
  { path: '/support/contact', priority: 0.5, changefreq: 'monthly' },
  { path: '/support/status', priority: 0.5, changefreq: 'hourly' },
  { path: '/app/replay', priority: 0.9, changefreq: 'daily' },
  { path: '/app/audit', priority: 0.8, changefreq: 'daily' },
  { path: '/app/policy', priority: 0.8, changefreq: 'weekly' },
  { path: '/app/metrics', priority: 0.7, changefreq: 'hourly' },
  { path: '/app/diagnostics', priority: 0.6, changefreq: 'daily' },
  { path: '/app/cas', priority: 0.6, changefreq: 'weekly' },
  { path: '/app/tenants', priority: 0.5, changefreq: 'weekly' },
];

// Dynamic routes that need to be fetched
export const dynamicRoutePatterns = [
  { path: '/runs/[runId]', priority: 0.7, changefreq: 'never' as const },
  { path: '/proof/diff/[token]', priority: 0.6, changefreq: 'never' as const },
];

function generateSitemapXML(entries: SitemapEntry[]): string {
  const today = new Date().toISOString().split('T')[0];

  const urlEntries = entries.map(entry => {
    const lastmod = entry.lastmod || today;
    return `  <url>
    <loc>${BASE_URL}${entry.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority.toFixed(1)}</priority>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

function generateRobotsTxt(): string {
  return `User-agent: *
Allow: /

# Crawl-delay for politeness
Crawl-delay: 1

# Sitemap location
Sitemap: ${BASE_URL}/sitemap.xml

# Disallow API routes
Disallow: /api/
Disallow: /internal/
Disallow: /_next/

# Allow public assets
Allow: /static/

# Host
Host: ${BASE_URL}
`;
}

export function generateSitemap(): void {
  const publicDir = join(process.cwd(), 'public');

  // Generate sitemap
  const sitemapXML = generateSitemapXML(staticRoutes);
  writeFileSync(join(publicDir, 'sitemap.xml'), sitemapXML);
  console.log('Generated sitemap.xml');

  // Generate robots.txt
  const robotsTxt = generateRobotsTxt();
  writeFileSync(join(publicDir, 'robots.txt'), robotsTxt);
  console.log('Generated robots.txt');
}

// Run if called directly
if (require.main === module) {
  generateSitemap();
}
