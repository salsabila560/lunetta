import "server-only";
import { createPublicClient, getAddress, http, isAddress } from "viem";
import { lunettaAbi } from "@/lib/abi";
import { chainConfig } from "@/lib/config";
import { getToken } from "@/lib/server/collection";
import { CONNECT_HEADER } from "./connect-message";
import { guestTraits } from "./guest";
import { ActionError, applyAction, describeFor, newResident, parseAction, publicResident, restoration } from "./logic";
import { ISLES } from "./map";
import {
  claimToken,
  getResident,
  hashKey,
  isPersistent,
  listResidents,
  loadWorld,
  mutate,
  newApiKey,
  newResidentId,
  registerKey,
  residentIdForKey,
} from "./store";
import type { Resident } from "./types";

export class AuthError extends Error {}

const client = createPublicClient({ chain: chainConfig.chain, transport: http(chainConfig.rpcUrl) });

export function cleanName(raw: unknown): string {
  const name = String(raw ?? "")
    .replace(/[^\p{L}\p{N} _.-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
  if (name.length < 2) throw new ActionError("Pick a name of 2-24 letters or numbers.");
  return name;
}

function field(message: string, label: string) {
  return message.match(new RegExp(`^${label}: (.+)$`, "m"))?.[1]?.trim() ?? null;
}

async function authed(apiKey: string | null): Promise<Resident> {
  if (!apiKey) throw new AuthError("Missing API key. Send it as `Authorization: Bearer <key>`.");
  const id = await residentIdForKey(apiKey);
  const r = id ? await getResident(id) : null;
  if (!r || r.keyHash !== hashKey(apiKey)) throw new AuthError("Unknown or revoked API key.");
  return r;
}

// ------------------------------------------------------------------ register

export type RegisterInput = {
  name?: unknown;
  tokenId?: unknown;
  address?: unknown;
  message?: unknown;
  signature?: unknown;
};

export async function register(input: RegisterInput, domain: string) {
  const now = Date.now();
  let name = cleanName(input.name);
  let tokenId: number | null = null;
  let owner: string | null = null;

  if (input.signature || input.message || input.address) {
    const message = String(input.message ?? "");
    const signature = String(input.signature ?? "") as `0x${string}`;
    const address = String(input.address ?? "");
    if (!message.startsWith(CONNECT_HEADER) || !isAddress(address)) throw new ActionError("Invalid signed message.");
    const issued = Date.parse(field(message, "Issued at") ?? "");
    if (field(message, "Domain") !== domain || Number.isNaN(issued) || now - issued > 10 * 60_000 || issued - now > 120_000) {
      throw new ActionError("Signature expired or for another site. Sign again.");
    }
    if (getAddress(field(message, "Wallet") ?? "0x0") !== getAddress(address)) throw new ActionError("Wallet mismatch.");
    const ok = await client.verifyMessage({ address: getAddress(address), message, signature });
    if (!ok) throw new ActionError("Signature check failed.");
    owner = getAddress(address);
    name = cleanName(field(message, "Name"));
    const t = field(message, "Lunetta");
    if (t && t !== "guest") {
      tokenId = Number(t);
      if (!chainConfig.isContractConfigured) throw new ActionError("The Lunetta contract isn't live yet. Join as a guest for now.");
      const holder = await client.readContract({
        address: chainConfig.contractAddress,
        abi: lunettaAbi,
        functionName: "ownerOf",
        args: [BigInt(tokenId)],
      });
      if (getAddress(holder) !== owner) throw new ActionError(`This wallet doesn't own Lunetta #${tokenId}.`);
    }
  }

  const traits = tokenId ? getToken(tokenId)?.traits : null;
  const apiKey = newApiKey();

  const resident = await mutate(async (w, save) => {
    // Re-connecting the same Lunetta (or after a sale) rotates the key on the existing resident.
    if (tokenId) {
      const freshId = newResidentId();
      const existingId = await claimToken(tokenId, freshId);
      if (existingId) {
        const r = await getResident(existingId);
        if (r) {
          r.keyHash = hashKey(apiKey);
          r.owner = owner;
          r.name = name;
          save(r);
          w.events.push({ at: now, kind: "join", who: r.id, name: r.name, isle: r.isle, text: `${r.name} (Lunetta #${tokenId}) has a new agent at the helm.` });
          return r;
        }
      }
      const r = newResident({ id: freshId, name, traits: traits ?? guestTraits(name), tokenId, owner, keyHash: hashKey(apiKey), now });
      save(r);
      w.events.push({ at: now, kind: "join", who: r.id, name, isle: r.isle, text: `${name} (Lunetta #${tokenId}) woke up on Hearthstead.` });
      return r;
    }
    const id = newResidentId();
    const r = newResident({ id, name, traits: guestTraits(`${name}:${id}`), tokenId: null, owner, keyHash: hashKey(apiKey), now });
    save(r);
    w.events.push({ at: now, kind: "join", who: id, name, isle: r.isle, text: `${name}, a wandering guest, woke up on Hearthstead.` });
    return r;
  });
  await registerKey(apiKey, resident.id);
  return { apiKey, resident };
}

// ------------------------------------------------------------------ look / act

export async function look(apiKey: string | null) {
  const r = await authed(apiKey);
  const now = Date.now();
  const w = await loadWorld(now);
  const all = await listResidents();
  return describeFor(r, w, all, now);
}

export async function act(apiKey: string | null, body: unknown) {
  const me = await authed(apiKey);
  const action = parseAction(body);
  return mutate(async (w, save) => {
    const now = Date.now();
    const r = (await getResident(me.id))!;
    const other = action.action === "give" ? await getResident(action.to) : null;
    const result = applyAction(w, r, action, now, other);
    save(r);
    if (other) save(other);
    return {
      ok: true,
      result,
      you: { isle: r.isle, energy: r.energy, inventory: r.inventory, readyInSeconds: Math.max(0, Math.ceil((r.nextActionAt - now) / 1000)) },
      halcyra: restoration(w),
    };
  });
}

// ------------------------------------------------------------------ public state

export async function publicState() {
  const now = Date.now();
  const w = await loadWorld(now);
  const residents = await listResidents();
  return {
    serverTime: now,
    persistent: isPersistent,
    restoration: restoration(w),
    nextHushInSeconds: Math.max(0, Math.ceil((w.lastHushAt + 8 * 60_000 - now) / 1000)),
    isles: ISLES.map((i) => ({ ...i, lit: w.isles[i.id].lit, structures: w.isles[i.id].structures })),
    residents: residents
      .filter((r) => now - r.createdAt < 30 * 24 * 3_600_000 || r.actions > 0)
      .map((r) => publicResident(r, now)),
    events: w.events.slice(-40).reverse(),
  };
}
