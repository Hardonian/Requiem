/**
 * Next.js Performance Configuration
 *
 * Bundle budgets, optimization, and performance ceilings
 */

import type { NextConfig } from 'next';

export const PERFORMANCE_BUDGETS = {
  // Marketing pages: < 100kb gzipped
  marketing: 100 * 1024,
  // App routes: < 200kb gzipped
  app: 200 * 1024,
  // API routes: < 50kb
  api: 50 * 1024,
};

const nextConfig: NextConfig = {
  // Output file tracing for optimal bundle
  outputFileTracing: true,
  outputFileTracingRoot: process.cwd(),

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      { protocol: 'https', hostname: 'requiem.hardonian.com' },
    ],
  },

  // Bundle analyzer in analyze mode
  ...(process.env.ANALYZE === 'true' && {
    webpack: async (config: { plugins: { push: (plugin: unknown) => void } }, { isServer }: { isServer: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer') as { BundleAnalyzerPlugin: new (opts: Record<string, unknown>) => unknown };
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: isServer ? '../analyze/server.html' : './analyze/client.html',
        }),
      );
      return config;
    },
  }),

  // Experimental performance features
  experimental: {
    // Optimize package imports for common libraries
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
    ],
    // Server Actions with strict origin checking
    serverActions: {
      allowedOrigins: [
        process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      ],
      bodySizeLimit: '1mb',
    },
  },

  // Compression
  compress: true,

  // Headers for performance
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Security
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Performance
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
      {
        // Cache static assets
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache Next.js chunks
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Rewrites for API proxy
  async rewrites() {
    const apiBase = process.env.REQUIEM_API_URL;
    if (!apiBase) return [];
    return [
      {
        source: '/internal/engine/:path*',
        destination: `${apiBase}/api/engine/:path*`,
      },
    ];
  },

  // Redirects for SEO
  async redirects() {
    return [
      // Enforce trailing slashes for consistency
      {
        source: '/:path((?!api/).*[^/])',
        destination: '/:path/',
        permanent: true,
      },
      // Remove duplicate content
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
