// ready-layer/src/lib/env.ts
//
// BOUNDARY CONTRACT: Environment validation for Vector Search subsystem
//
// This module provides typed environment variables with validation for
// Supabase/Postgres configuration used by the vector search subsystem.

import { z } from 'zod';

// Environment variable schema for the vector search subsystem
const envSchema = z.object({
  // Supabase configuration
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // Database connection (alternative to Supabase client)
  DATABASE_URL: z.string().url().optional(),

  // Existing Requiem configuration
  REQUIEM_AUTH_SECRET: z.string().min(1).optional(),
  REQUIEM_API_URL: z.string().url().optional(),
});

// Parsed environment variables
type Env = z.infer<typeof envSchema>;

// Cached parsed environment (avoids repeated parsing)
let cachedEnv: Env | null = null;

/**
 * Get and validate environment variables
 * 
 * @throws Error if required variables are missing in production
 * @returns Parsed environment variables
 */
export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const rawEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    REQUIEM_AUTH_SECRET: process.env.REQUIEM_AUTH_SECRET,
    REQUIEM_API_URL: process.env.REQUIEM_API_URL,
  };

  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    console.error('Environment validation failed:', result.error.format());
    throw new Error(`Invalid environment configuration: ${result.error.message}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

/**
 * Check if the vector search subsystem is properly configured
 * 
 * @returns true if Supabase or DATABASE_URL is configured
 */
export function isVectorSearchConfigured(): boolean {
  const env = getEnv();
  return !!(env.SUPABASE_URL && (env.SUPABASE_ANON_KEY || env.DATABASE_URL));
}

/**
 * Check if Supabase client is available
 * 
 * @returns true if Supabase client can be initialized
 */
export function isSupabaseConfigured(): boolean {
  const env = getEnv();
  return !!(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
}

/**
 * Get the database connection string
 * 
 * @returns DATABASE_URL or undefined
 */
export function getDatabaseUrl(): string | undefined {
  return getEnv().DATABASE_URL;
}

/**
 * Get the Supabase URL
 * 
 * @returns SUPABASE_URL or undefined
 */
export function getSupabaseUrl(): string | undefined {
  return getEnv().SUPABASE_URL;
}

/**
 * Get the Supabase anon key (for client-side use)
 * 
 * @returns SUPABASE_ANON_KEY or undefined
 */
export function getSupabaseAnonKey(): string | undefined {
  return getEnv().SUPABASE_ANON_KEY;
}

/**
 * Get the Supabase service role key (for server-side use only)
 * 
 * @returns SUPABASE_SERVICE_ROLE_KEY or undefined
 */
export function getSupabaseServiceRoleKey(): string | undefined {
  return getEnv().SUPABASE_SERVICE_ROLE_KEY;
}

// Re-export types for consumers
export type { Env };
