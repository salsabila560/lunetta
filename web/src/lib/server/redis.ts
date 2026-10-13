import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Upstash Redis client. Accepts both the Upstash names and the Vercel
 * Marketplace (KV_*) names, so connecting Upstash from the Vercel dashboard just works.
 */
export function redisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token, automaticDeserialization: false });
}
