export const INTERNAL_AUTH_PROOF_HEADER = 'x-requiem-auth-proof';
const INTERNAL_AUTH_CONTEXT_VERSION = 'v1';

function getInternalAuthSecret(): string | null {
  const secret = process.env.REQUIEM_AUTH_INTERNAL_SECRET ?? process.env.REQUIEM_AUTH_SECRET;
  return secret && secret.trim() ? secret.trim() : null;
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature))
    .map((part) => part.toString(16).padStart(2, '0'))
    .join('');
}

export function secureEqualHex(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

function buildInternalAuthPayload(input: {
  tenantId: string;
  actorId: string;
  method: string;
  pathname: string;
}): string {
  return [
    INTERNAL_AUTH_CONTEXT_VERSION,
    input.tenantId,
    input.actorId,
    input.method.toUpperCase(),
    input.pathname,
  ].join(':');
}

export async function createInternalAuthProof(input: {
  tenantId: string;
  actorId: string;
  method: string;
  pathname: string;
}): Promise<string | null> {
  const secret = getInternalAuthSecret();
  if (!secret) return null;
  return hmacSha256Hex(secret, buildInternalAuthPayload(input));
}
