/**
 * ReadyLayer Middleware Proxy
 * 
 * Tenant isolation and security middleware for the ReadyLayer dashboard.
 * Edge runtime compatible - no Node.js dependencies.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Static asset patterns that should never be processed by middleware
 */
const STATIC_ASSET_PATTERNS = [
  /\.(ico|png|jpg|jpeg|gif|svg|webp|css|js|map|woff|woff2|ttf|eot)$/i,
  /^\/_next\//,
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
];

/**
 * Public routes that don't require authentication
 */
const PUBLIC_ROUTES = [
  '/',
  '/auth/signin',
  '/auth/signup',
  '/auth/callback',
  '/auth/reset-password',
  '/api/auth',
  '/api/health',
  '/api/ready',
];

/**
 * Public API routes
 */
const PUBLIC_API_ROUTES = [
  '/api/health',
  '/api/ready',
];

/**
 * Check if a path is a static asset
 */
function isStaticAsset(pathname: string): boolean {
  return STATIC_ASSET_PATTERNS.some((pattern) => pattern.test(pathname));
}

/**
 * Check if a path is a public route
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Check if a path is a public API route
 */
function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Create Supabase client for Edge runtime
 */
function createEdgeSupabaseClient(request: NextRequest): {
  client: ReturnType<typeof createServerClient> | null;
  error: string | null;
} {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        client: null,
        error: 'Missing Supabase configuration',
      };
    }

    const response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const client = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          try {
            return request.cookies.getAll();
          } catch {
            return [];
          }
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value }: { name: string; value: string }) => {
              request.cookies.set(name, value);
            });
            cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: Record<string, unknown> }) => {
              response.cookies.set(name, value, options);
            });
          } catch {
            // Silently fail cookie setting
          }
        },
      },
    });

    return { client, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      client: null,
      error: errorMessage,
    };
  }
}

/**
 * Handle middleware errors gracefully
 */
function handleMiddlewareError(
  error: unknown,
  request: NextRequest,
  context: string
): NextResponse {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  // Safe logging
  try {
    console.error('Middleware error:', {
      context,
      path: request.nextUrl.pathname,
      error: errorMessage,
    });
  } catch {
    // Even logging failed
  }

  // For API routes, return JSON error
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while processing your request',
        },
      },
      { status: 500 }
    );
  }

  // For page routes, redirect to signin (fail-open for public routes)
  if (isPublicRoute(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const signInUrl = new URL('/auth/signin', request.url);
  signInUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
  return NextResponse.redirect(signInUrl);
}

/**
 * Get current user from Supabase session
 */
async function getCurrentUser(supabase: ReturnType<typeof createServerClient>): Promise<{ id: string; email?: string } | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return null;
    }
    return {
      id: user.id,
      email: user.email,
    };
  } catch {
    return null;
  }
}

/**
 * Main middleware function
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  // Ultimate safety net - catch any unhandled errors
  try {
    return await executeMiddleware(request);
  } catch (error) {
    return handleMiddlewareError(error, request, 'middleware top-level');
  }
}

async function executeMiddleware(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;

  // Skip static assets immediately
  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  // Public routes - always allow through
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Health and ready endpoints - always public
  if (isPublicApiRoute(pathname)) {
    return NextResponse.next();
  }

  // Create Supabase client
  const { client: supabase, error: supabaseError } = createEdgeSupabaseClient(request);

  // For API routes, check auth
  if (pathname.startsWith('/api/')) {
    if (!supabase) {
      console.warn('Supabase unavailable for API route:', pathname, supabaseError);
      return NextResponse.json(
        {
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Authentication service is temporarily unavailable',
          },
        },
        { status: 503 }
      );
    }

    // Check authentication
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    // Add user info to headers for downstream use
    const response = NextResponse.next();
    response.headers.set('x-user-id', user.id);
    if (user.email) {
      response.headers.set('x-user-email', user.email);
    }
    return response;
  }

  // Protect page routes (dashboard, etc.)
  if (!supabase) {
    console.warn('Supabase unavailable for page route:', pathname);
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Check authentication for page routes
  const user = await getCurrentUser(supabase);

  if (!user) {
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Add tenant isolation header
  const response = NextResponse.next();
  response.headers.set('x-tenant-id', user.id);
  response.headers.set('x-user-id', user.id);
  if (user.email) {
    response.headers.set('x-user-email', user.email);
  }

  return response;
}

/**
 * Middleware matcher configuration
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf|eot)$).*)',
  ],
};
