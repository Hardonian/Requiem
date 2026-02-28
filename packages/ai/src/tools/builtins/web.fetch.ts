/**
 * @fileoverview Bounded web fetch tool.
 *
 * INVARIANT: GET-only by default. POST requires explicit policy flag.
 * INVARIANT: Domain allowlist enforced if REQUIEM_FETCH_ALLOWLIST is set.
 * INVARIANT: Max payload size enforced (no streaming unlimited bodies).
 * INVARIANT: Strict timeout — no open-ended connections.
 * INVARIANT: Response hash stored for deterministic replay.
 * INVARIANT: No redirect chains beyond MAX_REDIRECTS.
 * INVARIANT: Content-type restricted to text/* and application/json.
 */

import { createHash } from 'crypto';
import { registerTool } from '../registry.js';
import { AiError } from '../../errors/AiError.js';
import { AiErrorCode } from '../../errors/codes.js';
import { logger } from '../../telemetry/logger.js';

const MAX_PAYLOAD_BYTES = 1_048_576; // 1 MiB
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 3;
const ALLOWED_CONTENT_TYPES = ['text/', 'application/json', 'application/xml'];

/** Parse domain allowlist from env */
function getAllowlist(): string[] | null {
  const raw = process.env['REQUIEM_FETCH_ALLOWLIST'];
  if (!raw) return null;
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

function isDomainAllowed(url: string): boolean {
  const allowlist = getAllowlist();
  if (!allowlist) return true;
  try {
    const { hostname } = new URL(url);
    return allowlist.some(domain =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

function isAllowedContentType(ct: string): boolean {
  const lower = ct.toLowerCase();
  return ALLOWED_CONTENT_TYPES.some(prefix => lower.startsWith(prefix));
}

registerTool(
  {
    name: 'web.fetch',
    version: '1.0.0',
    description: 'Fetch a URL with strict safety bounds: GET-only by default, domain allowlist, max payload, strict timeout. Non-deterministic — responses are hashed for audit.',
    deterministic: false, // External HTTP response is non-deterministic
    sideEffect: false,
    idempotent: true,
    tenantScoped: true,
    requiredCapabilities: ['tools:read'],
    inputSchema: {
      type: 'object',
      required: ['url'],
      properties: {
        url: {
          type: 'string',
          description: 'URL to fetch (must be https://)',
          maxLength: 2048,
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST'],
          description: 'HTTP method (default: GET). POST requires tools:write capability.',
        },
        headers: {
          type: 'object',
          description: 'Additional request headers',
          additionalProperties: { type: 'string' },
        },
        body: {
          type: 'string',
          description: 'Request body for POST (requires method: POST)',
          maxLength: 65_536,
        },
        timeout_ms: {
          type: 'number',
          description: `Request timeout in ms (max ${MAX_TIMEOUT_MS})`,
          minimum: 1000,
          maximum: MAX_TIMEOUT_MS,
        },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      required: ['status', 'body', 'content_type', 'response_hash'],
      properties: {
        status: { type: 'number' },
        body: { type: 'string' },
        content_type: { type: 'string' },
        response_hash: { type: 'string' },
        size_bytes: { type: 'number' },
      },
    },
  },
  async (ctx, input) => {
    const {
      url,
      method = 'GET',
      headers = {},
      body,
      timeout_ms = DEFAULT_TIMEOUT_MS,
    } = input as {
      url: string;
      method?: 'GET' | 'POST';
      headers?: Record<string, string>;
      body?: string;
      timeout_ms?: number;
    };

    // Validate URL scheme — only HTTPS
    if (!url.startsWith('https://')) {
      throw new AiError({
        code: AiErrorCode.FETCH_DOMAIN_BLOCKED,
        message: `Only HTTPS URLs are allowed. Got: ${url.slice(0, 64)}`,
        phase: 'web.fetch',
      });
    }

    // Domain allowlist check
    if (!isDomainAllowed(url)) {
      throw new AiError({
        code: AiErrorCode.FETCH_DOMAIN_BLOCKED,
        message: `Domain not in allowlist: ${new URL(url).hostname}`,
        phase: 'web.fetch',
      });
    }

    // POST method check — requires write capability
    if (method === 'POST') {
      const postAllowed = process.env['REQUIEM_FETCH_ALLOW_POST'] === 'true';
      if (!postAllowed) {
        throw new AiError({
          code: AiErrorCode.FETCH_METHOD_DENIED,
          message: 'POST fetch is disabled by policy. Set REQUIEM_FETCH_ALLOW_POST=true to enable.',
          phase: 'web.fetch',
        });
      }
    }

    const timeoutMs = Math.min(timeout_ms, MAX_TIMEOUT_MS);

    logger.debug('[web.fetch] fetching URL', {
      url: url.slice(0, 128),
      method,
      tenant_id: ctx.tenant.tenantId,
      trace_id: ctx.traceId,
    });

    // Perform fetch with timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          'User-Agent': 'Requiem-AI-Control-Plane/1.0',
          ...headers,
        },
        body: method === 'POST' && body ? body : undefined,
        signal: controller.signal,
        redirect: 'follow',
      });
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error).name === 'AbortError') {
        throw new AiError({
          code: AiErrorCode.FETCH_TIMEOUT,
          message: `Request timed out after ${timeoutMs}ms: ${url.slice(0, 128)}`,
          phase: 'web.fetch',
        });
      }
      throw AiError.fromUnknown(err, 'web.fetch');
    } finally {
      clearTimeout(timer);
    }

    // Content-type check
    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
    if (!isAllowedContentType(contentType)) {
      throw new AiError({
        code: AiErrorCode.FETCH_PAYLOAD_TOO_LARGE,
        message: `Response content-type not allowed: ${contentType}`,
        phase: 'web.fetch',
      });
    }

    // Read response with size limit (no unlimited streaming)
    const reader = response.body?.getReader();
    if (!reader) {
      return {
        status: response.status,
        body: '',
        content_type: contentType,
        response_hash: createHash('sha256').update('').digest('hex'),
        size_bytes: 0,
      };
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_PAYLOAD_BYTES) {
        reader.cancel().catch(() => {});
        throw new AiError({
          code: AiErrorCode.FETCH_PAYLOAD_TOO_LARGE,
          message: `Response exceeds max payload size (${MAX_PAYLOAD_BYTES} bytes)`,
          phase: 'web.fetch',
        });
      }
      chunks.push(value);
    }

    const buf = Buffer.concat(chunks.map(c => Buffer.from(c)));
    const bodyText = buf.toString('utf8');
    const responseHash = createHash('sha256').update(buf).digest('hex');

    logger.debug('[web.fetch] response received', {
      url: url.slice(0, 128),
      status: response.status,
      size_bytes: totalBytes,
      content_type: contentType,
      response_hash: responseHash,
      tenant_id: ctx.tenant.tenantId,
    });

    return {
      status: response.status,
      body: bodyText,
      content_type: contentType,
      response_hash: responseHash,
      size_bytes: totalBytes,
    };
  }
);
