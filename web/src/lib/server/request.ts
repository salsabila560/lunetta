import "server-only";
import { createHash } from "node:crypto";

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** We never store raw IPs — only a salted hash, for abuse investigation. */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export function whitelistStatus(count?: number) {
  const flag = (process.env.WHITELIST_OPEN ?? "false").toLowerCase() === "true";
  const closesAt = process.env.WHITELIST_CLOSES_AT ? new Date(process.env.WHITELIST_CLOSES_AT) : null;
  const maxSpots = Number(process.env.WHITELIST_MAX_SPOTS ?? 0) || 0;
  const pastDeadline = closesAt ? Date.now() > closesAt.getTime() : false;
  const full = maxSpots > 0 && typeof count === "number" && count >= maxSpots;
  return {
    open: flag && !pastDeadline && !full,
    closesAt: closesAt && !Number.isNaN(closesAt.getTime()) ? closesAt.toISOString() : null,
    maxSpots,
    full,
  };
}
