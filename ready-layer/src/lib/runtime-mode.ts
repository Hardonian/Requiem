const PRODUCTION_LIKE_ENVS = new Set(['production', 'staging']);

export function getNodeEnv(): string {
  return (process.env.NODE_ENV ?? 'development').toLowerCase();
}

export function isProductionLikeRuntime(): boolean {
  return PRODUCTION_LIKE_ENVS.has(getNodeEnv());
}

export function isDevelopmentRuntime(): boolean {
  return getNodeEnv() === 'development';
}

export function isTestRuntime(): boolean {
  return getNodeEnv() === 'test';
}
