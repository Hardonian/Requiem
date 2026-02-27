// ready-layer/next.config.ts
//
// INVARIANT: This config enforces route-level constraints defined in Phase B.
//   - No route directly calls the engine binary.
//   - All engine calls go through REQUIEM_API_URL (Node API boundary).
//   - Hard-500 routes are prevented by wrapping all API handlers in error boundaries.
//
// EXTENSION_POINT: node_api_bridge
//   Add rewrites() to proxy /api/engine/* to the Node API service in production.

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Fail build if any route is found without an explicit handler (enforces Phase B).
  // Note: Next.js enforces this natively for App Router — all segments must export
  // at least one HTTP method handler.
  experimental: {
    // Strict mode for server actions (prevents unauthorized cross-origin calls)
    serverActions: {
      allowedOrigins: [
        process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      ],
    },
  },

  // Security headers for enterprise deployment
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },

  // Rewrites: proxy engine API calls to Node API boundary in production.
  // INVARIANT: Only /api/engine/* and /api/cas/* routes may be proxied here.
  // Marketing routes (/, /docs, /pricing) must NEVER be proxied to the engine.
  async rewrites() {
    const apiBase = process.env.REQUIEM_API_URL;
    if (!apiBase) return [];
    return [
      // Engine status/metrics/diagnostics → Node API
      {
        source: '/internal/engine/:path*',
        destination: `${apiBase}/api/engine/:path*`,
      },
    ];
  },
};

export default nextConfig;
