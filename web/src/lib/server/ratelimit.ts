import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Result = { success: boolean; reset: number };

const hasUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

const upstash = hasUpstash
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, "10 m"),
      prefix: "lunetta:wl",
      analytics: false,
    })
  : null;

// Development fallback only: per-instance memory is NOT shared across serverless lambdas.
const memory = new Map<string, number[]>();
function memoryLimit(key: string, max = 5, windowMs = 10 * 60 * 1000): Result {
  const now = Date.now();
  const hits = (memory.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  memory.set(key, hits);
  return { success: hits.length <= max, reset: hits[0] + windowMs };
}

export async function rateLimit(key: string): Promise<Result> {
  if (upstash) {
    const r = await upstash.limit(key);
    return { success: r.success, reset: r.reset };
  }
  if (process.env.NODE_ENV === "production") {
    console.warn("[ratelimit] UPSTASH_REDIS_* not set — falling back to in-memory limiter. Configure Upstash before launch.");
  }
  return memoryLimit(key);
}
