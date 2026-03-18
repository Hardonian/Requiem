import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ProblemError } from './problem-json';
import { isProductionLikeRuntime } from './runtime-mode';

export interface SupabaseServiceConfig {
  url: string | null;
  serviceRoleKey: string | null;
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseServiceConfig(): SupabaseServiceConfig {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
  return { url, serviceRoleKey };
}

export function isSupabaseServiceConfigured(): boolean {
  const config = getSupabaseServiceConfig();
  return Boolean(config.url && config.serviceRoleKey);
}

export function assertSupabaseServiceConfigured(options: {
  feature: string;
  code: string;
}): void {
  if (isSupabaseServiceConfigured()) {
    return;
  }

  if (!isProductionLikeRuntime()) {
    return;
  }

  throw new ProblemError(
    503,
    'Setup Required',
    `${options.feature} requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in production-like deployments.`,
    { code: options.code },
  );
}

export function getSupabaseServiceClient(options: {
  feature: string;
  code: string;
}): SupabaseClient | null {
  const config = getSupabaseServiceConfig();
  if (!config.url || !config.serviceRoleKey) {
    assertSupabaseServiceConfigured(options);
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(config.url, config.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          'x-client-info': 'ready-layer-supabase-service',
        },
      },
    });
  }

  return cachedClient;
}

export function resetSupabaseServiceClientForTests(): void {
  cachedClient = null;
}
