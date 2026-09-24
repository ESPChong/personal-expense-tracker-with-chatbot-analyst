// Per-key, per-UTC-day in-memory rate limiting. Fine for a single dev process;
// swap for a Mongo counter before deploying multi-instance (cold starts reset
// it, and each server instance keeps its own map).
const buckets = new Map<string, { day: string; count: number }>();

function nextUtcMidnight(now: Date): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  ).toISOString();
}

export function checkRateLimit(key: string, limit: number) {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const bucket = buckets.get(key);

  if (!bucket || bucket.day !== day) {
    buckets.set(key, { day, count: 1 });
    return { allowed: true, remaining: limit - 1, resetAt: nextUtcMidnight(now) };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: nextUtcMidnight(now) };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, resetAt: nextUtcMidnight(now) };
}

// Test-only: the map otherwise persists across tests within a worker.
export function resetRateLimiter() {
  buckets.clear();
}
