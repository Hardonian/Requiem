/**
 * ReadyLayer Middleware Proxy
 *
 * Tenant isolation and security middleware for the ReadyLayer dashboard.
 * Edge runtime compatible - no Node.js dependencies.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createInternalAuthProof, INTERNAL_AUTH_PROOF_HEADER } from '@/lib/internal-auth-proof';

const STATIC_ASSET_PATTERNS = [
  /\.(ico|png|jpg|jpeg|gif|svg|webp|css|js|map|woff|woff2|ttf|eot)$/i,
  /^\/_next\//,
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
];

const PUBLIC_ROUTES = [
  '/',
  '/about',
  '/features',
  '/docs',
  '/documentation',
  '/features',
  '/demo',
  '/enterprise',
  '/templates',
  '/pricing',
  '/security',
  '/support',
  '/support/contact',
  '/support/status',
  '/transparency',
  '/library',
  '/templates',
  '/enterprise',
  '/enterprise/request-demo',
  '/demo',
  '/status',
  '/changelog',
  '/transparency',
  '/security',
  '/privacy',
  '/terms',
  '/support',
  '/login',
  '/signup',
  '/auth/signin',
  '/auth/signup',
  '/auth/callback',
  '/auth/reset-password',
  '/proof/diff',
  '/api/auth',
  '/api/health',
  '/api/ready',
  '/api/openapi.json',
  '/api/status',
];

const PROTECTED_PAGE_PREFIXES = [
  '/app',
  '/console',
  '/intelligence',
  '/runs',
  '/registry',
  '/settings',
  '/drift',
  '/spend',
  '/proof',
];

const PUBLIC_API_ROUTES = [
  '/api/health',
  '/api/ready',
  '/api/openapi.json',
  '/api/status',
];

function isStaticAsset(pathname: string): boolean {
  return STATIC_ASSET_PATTERNS.some((pattern) => pattern.test(pathname));
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isProtectedPageRoute(pathname: string): boolean {
  return PROTECTED_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function resolveTraceId(request: NextRequest): string {
  const incoming = request.headers.get('x-trace-id');
  if (incoming && incoming.trim()) {
    return incoming;
  }

  const traceparent = request.headers.get('traceparent');
  if (traceparent) {
    const parts = traceparent.split('-');
    if (parts.length >= 2 && parts[1]) {
      return parts[1];
    }
  }

  return crypto.randomUUID();
}

function problemResponse(
  status: number,
  title: string,
  detail: string,
  traceId: string,
  code?: string,
): NextResponse {
  return new NextResponse(
    JSON.stringify({
      type: `https://httpstatuses.com/${status}`,
      title,
      status,
      detail,
      trace_id: traceId,
      ...(code ? { code } : {}),
    }),
    {
      status,
      headers: {
        'content-type': 'application/problem+json',
        'x-trace-id': traceId,
      },
    },
  );
}

function withTraceHeader(response: NextResponse, traceId: string): NextResponse {
  response.headers.set('x-trace-id', traceId);
  return response;
}

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
        error: 'missing_supabase_config',
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
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value);
            });
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          } catch {
            // ignore cookie persistence errors
          }
        },
      },
    });

    return { client, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'unknown_error';
    return {
      client: null,
      error: errorMessage,
    };
  }
}

function handleMiddlewareError(
  error: unknown,
  request: NextRequest,
  context: string,
  traceId: string,
): NextResponse {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  try {
    console.error('Middleware error', {
      context,
      path: request.nextUrl.pathname,
      trace_id: traceId,
      error: errorMessage,
    });
  } catch {
    // ignore logging failures
  }

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return problemResponse(
      500,
      'Internal Server Error',
      'Request failed safely',
      traceId,
      'middleware_internal_error',
    );
  }

  if (isPublicRoute(request.nextUrl.pathname)) {
    return withTraceHeader(NextResponse.next(), traceId);
  }

  const signInUrl = new URL('/auth/signin', request.url);
  signInUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
  return withTraceHeader(NextResponse.redirect(signInUrl), traceId);
}

async function getCurrentUser(
  supabase: ReturnType<typeof createServerClient>,
): Promise<{ id: string; email?: string } | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

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

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const traceId = resolveTraceId(request);

  try {
    return await executeMiddleware(request, traceId);
  } catch (error) {
    return handleMiddlewareError(error, request, 'middleware_top_level', traceId);
  }
}

async function executeMiddleware(request: NextRequest, traceId: string): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;

  if (isStaticAsset(pathname)) {
    return withTraceHeader(NextResponse.next(), traceId);
  }

  if (isPublicRoute(pathname) || isPublicApiRoute(pathname)) {
    return withTraceHeader(NextResponse.next(), traceId);
  }

  const isProtectedPage = !pathname.startsWith('/api/') && isProtectedPageRoute(pathname);

  if (!pathname.startsWith('/api/') && !isProtectedPage) {
    return withTraceHeader(NextResponse.next(), traceId);
  }

  const { client: supabase, error: supabaseError } = createEdgeSupabaseClient(request);

  if (
    process.env.REQUIEM_ROUTE_VERIFY_MODE === '1'
    && process.env.NODE_ENV !== 'production'
    && (pathname.startsWith('/api/') || isProtectedPage)
  ) {
    const verifyHeaders = new Headers(request.headers);
    const verifyTenant = verifyHeaders.get('x-tenant-id') ?? process.env.REQUIEM_ROUTE_VERIFY_TENANT ?? 'verify-tenant';
    const verifyActor = verifyHeaders.get('x-user-id') ?? verifyTenant;
    verifyHeaders.set('x-trace-id', traceId);
    verifyHeaders.set('x-requiem-authenticated', '1');
    verifyHeaders.set('x-tenant-id', verifyTenant);
    verifyHeaders.set('x-user-id', verifyActor);
    const proof = await createInternalAuthProof({
      tenantId: verifyTenant,
      actorId: verifyActor,
      method: request.method,
      pathname,
    });
    if (proof) {
      verifyHeaders.set(INTERNAL_AUTH_PROOF_HEADER, proof);
    } else {
      verifyHeaders.delete(INTERNAL_AUTH_PROOF_HEADER);
    }
    const response = NextResponse.next({
      request: {
        headers: verifyHeaders,
      },
    });
    response.headers.set('x-tenant-id', verifyHeaders.get('x-tenant-id') ?? 'verify-tenant');
    response.headers.set('x-requiem-authenticated', '1');
    return withTraceHeader(response, traceId);
  }

  if (pathname.startsWith('/api/')) {
    if (!supabase) {
      console.warn('Supabase unavailable for API route', {
        path: pathname,
        trace_id: traceId,
        error: supabaseError,
      });
      return problemResponse(
        503,
        'Service Unavailable',
        'Authentication service is temporarily unavailable',
        traceId,
        'auth_service_unavailable',
      );
    }

    const user = await getCurrentUser(supabase);
    if (!user) {
      return problemResponse(
        401,
        'Authentication Failed',
        'Authentication required',
        traceId,
        'unauthorized',
      );
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', user.id);
    requestHeaders.set('x-tenant-id', user.id);
    requestHeaders.set('x-requiem-authenticated', '1');
    requestHeaders.set('x-trace-id', traceId);
    const proof = await createInternalAuthProof({
      tenantId: user.id,
      actorId: user.id,
      method: request.method,
      pathname,
    });
    if (proof) {
      requestHeaders.set(INTERNAL_AUTH_PROOF_HEADER, proof);
    }

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    response.headers.set('x-user-id', user.id);
    response.headers.set('x-tenant-id', user.id);
    response.headers.set('x-requiem-authenticated', '1');

    return withTraceHeader(response, traceId);
  }

  if (!supabase) {
    console.warn('Supabase unavailable for page route', {
      path: pathname,
      trace_id: traceId,
      error: supabaseError,
    });
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return withTraceHeader(NextResponse.redirect(signInUrl), traceId);
  }

  const user = await getCurrentUser(supabase);
  if (!user) {
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return withTraceHeader(NextResponse.redirect(signInUrl), traceId);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', user.id);
  requestHeaders.set('x-tenant-id', user.id);
  requestHeaders.set('x-requiem-authenticated', '1');
  requestHeaders.set('x-trace-id', traceId);
  const proof = await createInternalAuthProof({
    tenantId: user.id,
    actorId: user.id,
    method: request.method,
    pathname,
  });
  if (proof) {
    requestHeaders.set(INTERNAL_AUTH_PROOF_HEADER, proof);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set('x-tenant-id', user.id);
  response.headers.set('x-requiem-authenticated', '1');

  return withTraceHeader(response, traceId);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf|eot)$).*)',
  ],
};
