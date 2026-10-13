import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { redisClient } from "@/lib/server/redis";
import { newWorld, tick } from "./logic";
import type { Resident, World } from "./types";

/**
 * Persistence for Halcyra Live.
 * - Upstash Redis when configured (shared by every server instance).
 * - Otherwise an in-memory "demo" store: works instantly, but each serverless
 *   instance has its own copy and it resets on redeploy.
 */

const K = {
  world: "lw:world",
  residents: "lw:residents",
  keys: "lw:keys",
  token: (id: number) => `lw:token:${id}`,
  lock: "lw:lock",
};

type Mem = { world: World | null; residents: Map<string, string>; keys: Map<string, string>; tokens: Map<number, string> };
declare global {
  var __lunettaWorldMem: Mem | undefined;
}
function mem(): Mem {
  if (!globalThis.__lunettaWorldMem) globalThis.__lunettaWorldMem = { world: null, residents: new Map(), keys: new Map(), tokens: new Map() };
  return globalThis.__lunettaWorldMem;
}

const redis = redisClient();
export const isPersistent = Boolean(redis);

export function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function newApiKey() {
  return `lw_${randomBytes(24).toString("base64url")}`;
}

export function newResidentId() {
  return `r_${randomBytes(5).toString("hex")}`;
}

// ------------------------------------------------------------------ world

async function readWorldRaw(): Promise<World | null> {
  if (!redis) return mem().world;
  const raw = await redis.get<string>(K.world);
  return raw ? (JSON.parse(raw) as World) : null;
}

async function writeWorld(w: World) {
  if (!redis) {
    mem().world = w;
    return;
  }
  await redis.set(K.world, JSON.stringify(w));
}

/** Reads the world, creating it on first use and applying any pending Hush visits. */
export async function loadWorld(now: number): Promise<World> {
  let w = await readWorldRaw();
  if (!w) {
    w = newWorld(now);
    await writeWorld(w);
    return w;
  }
  if (tick(w, now)) await writeWorld(w);
  return w;
}

// ------------------------------------------------------------------ residents

export async function getResident(id: string): Promise<Resident | null> {
  const raw = redis ? await redis.hget<string>(K.residents, id) : mem().residents.get(id) ?? null;
  return raw ? (JSON.parse(raw) as Resident) : null;
}

/**
 * With `automaticDeserialization: false` Upstash returns HGETALL as the raw flat
 * reply `[field, value, field, value, ...]`, not an object. Accept both shapes and
 * return only the values.
 */
function hashValues(raw: unknown): unknown[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((_, i) => i % 2 === 1);
  if (typeof raw === "object") return Object.values(raw as Record<string, unknown>);
  return [];
}

function parseResident(v: unknown): Resident | null {
  try {
    const r = (typeof v === "string" ? JSON.parse(v) : v) as Resident | null;
    return r && typeof r === "object" && typeof r.id === "string" ? r : null;
  } catch {
    return null;
  }
}

export async function listResidents(): Promise<Resident[]> {
  const values = redis ? hashValues(await redis.hgetall(K.residents)) : [...mem().residents.values()];
  const out: Resident[] = [];
  for (const v of values) {
    const r = parseResident(v);
    if (r) out.push(r);
    else console.error("[world] skipped unreadable resident record");
  }
  return out;
}

async function saveResident(r: Resident) {
  if (!redis) mem().residents.set(r.id, JSON.stringify(r));
  else await redis.hset(K.residents, { [r.id]: JSON.stringify(r) });
}

export async function residentIdForKey(apiKey: string): Promise<string | null> {
  const h = hashKey(apiKey);
  if (!redis) return mem().keys.get(h) ?? null;
  return (await redis.hget<string>(K.keys, h)) ?? null;
}

export async function registerKey(apiKey: string, residentId: string) {
  const h = hashKey(apiKey);
  if (!redis) mem().keys.set(h, residentId);
  else await redis.hset(K.keys, { [h]: residentId });
}

/** Binds a Lunetta token to one resident. Returns the existing resident id if already claimed. */
export async function claimToken(tokenId: number, residentId: string): Promise<string | null> {
  if (!redis) {
    const m = mem();
    const existing = m.tokens.get(tokenId);
    if (existing) return existing;
    m.tokens.set(tokenId, residentId);
    return null;
  }
  const ok = await redis.set(K.token(tokenId), residentId, { nx: true });
  if (ok) return null;
  return (await redis.get<string>(K.token(tokenId))) ?? null;
}

export async function residentForToken(tokenId: number): Promise<string | null> {
  if (!redis) return mem().tokens.get(tokenId) ?? null;
  return (await redis.get<string>(K.token(tokenId))) ?? null;
}

// ------------------------------------------------------------------ mutations

let localChain: Promise<unknown> = Promise.resolve();

/**
 * Runs a read-modify-write on the world and residents under a lock so two
 * agents acting at the same moment don't overwrite each other.
 */
export async function mutate<T>(fn: (w: World, save: (r: Resident) => void) => Promise<T> | T): Promise<T> {
  const run = async () => {
    const owner = randomBytes(8).toString("hex");
    if (redis) {
      let got = false;
      for (let i = 0; i < 40 && !got; i++) {
        got = Boolean(await redis.set(K.lock, owner, { nx: true, px: 4000 }));
        if (!got) await new Promise((r) => setTimeout(r, 75));
      }
      if (!got) throw new Error("The world is busy. Try again in a moment.");
    }
    try {
      const now = Date.now();
      const w = await loadWorld(now);
      const dirty: Resident[] = [];
      const result = await fn(w, (r) => dirty.push(r));
      await writeWorld(w);
      for (const r of dirty) await saveResident(r);
      return result;
    } finally {
      if (redis) {
        const holder = await redis.get<string>(K.lock);
        if (holder === owner) await redis.del(K.lock);
      }
    }
  };
  // serialize within this instance too
  const p = localChain.then(run, run);
  localChain = p.catch(() => undefined);
  return p;
}
