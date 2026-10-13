import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Result = { success: boolean; reset: number };

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const limiters = new Map<string, Ratelimit>();
function limiter(max: number, window: `${number} m` | `${number} h`, prefix: string) {
  const key = `${prefix}:${max}:${window}`;
  if (!redis) return null;
  let l = limiters.get(key);
  if (!l) {
    l = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(max, window), prefix, analytics: false });
    limiters.set(key, l);
  }
  return l;
}

// Development fallback only: per-instance memory is NOT shared across serverless lambdas.
const memory = new Map<string, number[]>();
function memoryLimit(key: string, max = 5, windowMs = 10 * 60 * 1000): Result {
  const now = Date.now();
  const hits = (memory.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  memory.set(key, hits);
  return { success: hits.length <= max, reset: hits[0] + windowMs };
}

export async function rateLimit(
  key: string,
  opts: { max?: number; window?: `${number} m` | `${number} h`; prefix?: string } = {},
): Promise<Result> {
  const max = opts.max ?? 5;
  const window = opts.window ?? "10 m";
  const l = limiter(max, window, opts.prefix ?? "lunetta:wl");
  if (l) {
    const r = await l.limit(key);
    return { success: r.success, reset: r.reset };
  }
  if (process.env.NODE_ENV === "production") {
    console.warn("[ratelimit] Upstash Redis not configured — falling back to in-memory limiter. Configure Upstash before launch.");
  }
  const ms = parseInt(window, 10) * (window.endsWith("h") ? 3_600_000 : 60_000);
  return memoryLimit(`${opts.prefix ?? "wl"}:${key}`, max, ms);
}
