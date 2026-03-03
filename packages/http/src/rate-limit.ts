const bucket = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit = 120, windowMs = 60_000): boolean {
  const now = Date.now();
  const state = bucket.get(key);
  if (!state || state.resetAt <= now) {
    bucket.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (state.count >= limit) return false;
  state.count += 1;
  return true;
}
