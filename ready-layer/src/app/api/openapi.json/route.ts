import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';

export const dynamic = 'force-dynamic';

const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'ReadyLayer API',
    version: '1.0.0',
    description: 'Tenant-isolated API with Problem+JSON errors, tracing, and idempotent writes.',
  },
  servers: [{ url: '/' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
      },
    },
    parameters: {
      traceId: {
        name: 'x-trace-id',
        in: 'header',
        required: false,
        schema: { type: 'string' },
        description: 'Client-provided trace correlation id.',
      },
      idempotencyKey: {
        name: 'idempotency-key',
        in: 'header',
        required: false,
        schema: { type: 'string', minLength: 1, maxLength: 255 },
        description: 'Enables safe retries for mutating endpoints.',
      },
    },
    schemas: {
      Problem: {
        type: 'object',
        required: ['type', 'title', 'status', 'detail', 'trace_id'],
        properties: {
          type: { type: 'string', format: 'uri' },
          title: { type: 'string' },
          status: { type: 'integer', minimum: 100, maximum: 599 },
          detail: { type: 'string' },
          trace_id: { type: 'string' },
          code: { type: 'string' },
          errors: {
            type: 'array',
            items: { type: 'object', additionalProperties: true },
          },
        },
      },
      HealthResponse: {
        type: 'object',
        required: ['ok', 'status', 'timestamp_unix_ms', 'checks'],
        properties: {
          ok: { type: 'boolean' },
          status: { type: 'string', enum: ['healthy', 'degraded'] },
          engine_version: { type: 'string' },
          timestamp_unix_ms: { type: 'integer' },
          checks: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name', 'ok', 'message'],
              properties: {
                name: { type: 'string' },
                ok: { type: 'boolean' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      VectorSearchRequest: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string' },
          index_key: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          min_similarity: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
      VectorSearchResponse: {
        type: 'object',
        required: ['ok', 'results', 'query', 'total', 'latency_ms', 'trace_id'],
        properties: {
          ok: { type: 'boolean' },
          results: { type: 'array', items: { type: 'object', additionalProperties: true } },
          query: { type: 'string' },
          total: { type: 'integer' },
          latency_ms: { type: 'integer' },
          trace_id: { type: 'string' },
        },
      },
    },
    responses: {
      Problem400: {
        description: 'Bad request',
        content: {
          'application/problem+json': {
            schema: { $ref: '#/components/schemas/Problem' },
            examples: {
              invalidQuery: {
                value: {
                  type: 'https://httpstatuses.com/400',
                  title: 'Validation Failed',
                  status: 400,
                  detail: 'Request validation failed',
                  code: 'validation_error',
                  trace_id: '5f0baf16e70f4abebea179446615f4e2',
                },
              },
            },
          },
        },
      },
      Problem401: {
        description: 'Authentication failed',
        content: {
          'application/problem+json': {
            schema: { $ref: '#/components/schemas/Problem' },
            examples: {
              authFailed: {
                value: {
                  type: 'https://httpstatuses.com/401',
                  title: 'Authentication Failed',
                  status: 401,
                  detail: 'Missing bearer token',
                  code: 'missing_auth',
                  trace_id: '09f0d5f28f4b42adb78d2e8f3188ea26',
                },
              },
            },
          },
        },
      },
      Problem429: {
        description: 'Rate limited',
        content: {
          'application/problem+json': {
            schema: { $ref: '#/components/schemas/Problem' },
            examples: {
              throttled: {
                value: {
                  type: 'https://httpstatuses.com/429',
                  title: 'Too Many Requests',
                  status: 429,
                  detail: 'Rate limit exceeded',
                  code: 'rate_limited',
                  trace_id: '6ad23a6bb55a4f2f95f4d95bfd1eb844',
                },
              },
            },
          },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        summary: 'Health check',
        parameters: [{ $ref: '#/components/parameters/traceId' }],
        responses: {
          '200': {
            description: 'Service health envelope',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
    '/api/engine/status': {
      get: {
        summary: 'Get engine runtime status',
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/traceId' }],
        responses: {
          '200': {
            description: 'Engine status payload',
            content: {
              'application/json': {
                schema: { type: 'object', additionalProperties: true },
              },
            },
          },
          '401': { $ref: '#/components/responses/Problem401' },
          '429': { $ref: '#/components/responses/Problem429' },
        },
      },
    },
    '/api/vector/search': {
      get: {
        summary: 'Vector search route metadata',
        responses: {
          '200': {
            description: 'Route usage metadata',
            content: {
              'application/json': {
                schema: { type: 'object', additionalProperties: true },
              },
            },
          },
        },
      },
      post: {
        summary: 'Run semantic vector search',
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/traceId' },
          { $ref: '#/components/parameters/idempotencyKey' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/VectorSearchRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Search results',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/VectorSearchResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/Problem400' },
          '401': { $ref: '#/components/responses/Problem401' },
          '429': { $ref: '#/components/responses/Problem429' },
        },
      },
    },
    '/api/budgets': {
      get: {
        summary: 'Get tenant budget view',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Budget envelope',
            content: {
              'application/json': {
                schema: { type: 'object', additionalProperties: true },
              },
            },
          },
          '401': { $ref: '#/components/responses/Problem401' },
        },
      },
      post: {
        summary: 'Update/reset budgets',
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/idempotencyKey' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  action: { type: 'string', enum: ['set', 'reset-window'] },
                  unit: { type: 'string' },
                  limit: { type: 'number' },
                },
                required: ['action'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Mutation accepted',
            content: {
              'application/json': {
                schema: { type: 'object', additionalProperties: true },
              },
            },
          },
          '400': { $ref: '#/components/responses/Problem400' },
          '401': { $ref: '#/components/responses/Problem401' },
        },
      },
    },
  },
} as const;

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async () => {
      return NextResponse.json(openApiSpec, {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
        },
      });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      requireAuth: false,
      routeId: 'openapi.spec',
      rateLimit: false,
      cache: { ttlMs: 120_000, visibility: 'public', staleWhileRevalidateMs: 120_000 },
    },
  );
}
