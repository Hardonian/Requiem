import { secureEqualHex } from './internal-auth-proof';

export interface DirectBearerIdentity {
  tenant_id: string;
  actor_id: string;
}

type DirectBearerClaims = DirectBearerIdentity & {
  sub?: string;
  iss?: string;
  aud?: string;
  exp?: number;
  nbf?: number;
};

const HEADER = { alg: 'HS256', typ: 'JWT', v: 1 } as const;

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): string | null {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
    return atob(padded);
  } catch {
    return null;
  }
}

async function sign(input: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input));
  return Array.from(new Uint8Array(signature)).map((part) => part.toString(16).padStart(2, '0')).join('');
}

/** Production direct-bearer contract: JWT-like HS256 token with server-bound tenant and actor claims. */
export async function createDirectBearerToken(
  identity: DirectBearerIdentity,
  secret: string,
  options: { expires_at?: number; issuer?: string; audience?: string } = {},
): Promise<string> {
  const payload: DirectBearerClaims = {
    tenant_id: identity.tenant_id,
    actor_id: identity.actor_id,
    sub: identity.actor_id,
    ...(options.expires_at ? { exp: options.expires_at } : {}),
    ...(options.issuer ? { iss: options.issuer } : {}),
    ...(options.audience ? { aud: options.audience } : {}),
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(HEADER));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const input = `${encodedHeader}.${encodedPayload}`;
  return `${input}.${await sign(input, secret)}`;
}

export async function verifyDirectBearerToken(token: string, secret: string): Promise<DirectBearerIdentity | null> {
  const parts = token.split('.');
  if (parts.length !== 3 || !secret.trim()) return null;
  const [encodedHeader, encodedPayload, signature] = parts;
  const expected = await sign(`${encodedHeader}.${encodedPayload}`, secret);
  if (!secureEqualHex(expected, signature)) return null;

  const headerText = base64UrlDecode(encodedHeader);
  const payloadText = base64UrlDecode(encodedPayload);
  if (!headerText || !payloadText) return null;

  try {
    const header = JSON.parse(headerText) as { alg?: string; typ?: string; v?: number };
    const claims = JSON.parse(payloadText) as DirectBearerClaims;
    if (header.alg !== 'HS256' || header.typ !== 'JWT' || header.v !== 1) return null;
    if (!claims.tenant_id?.trim() || !claims.actor_id?.trim() || claims.sub !== claims.actor_id) return null;
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp !== undefined && (!Number.isFinite(claims.exp) || claims.exp <= now)) return null;
    if (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now)) return null;
    return { tenant_id: claims.tenant_id.trim(), actor_id: claims.actor_id.trim() };
  } catch {
    return null;
  }
}
