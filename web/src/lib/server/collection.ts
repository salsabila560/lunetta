import "server-only";
import { createPublicClient, http } from "viem";
import collection from "../../../data/collection.json";
import { lunettaAbi } from "@/lib/abi";
import { chainConfig, siteConfig } from "@/lib/config";
import type { Traits } from "@/lib/art/render";

export type Token = {
  id: number;
  name: string;
  seed: number;
  rank: number;
  tier: string;
  traits: Traits;
};

const tokens = collection as Token[];
export const COLLECTION_SIZE = tokens.length;

export function getToken(id: number): Token | null {
  if (!Number.isInteger(id) || id < 1 || id > tokens.length) return null;
  return tokens[id - 1] ?? null;
}

/** Parses "12", "12.json" or "12.svg" into a token id. */
export function parseId(raw: string): number {
  const m = raw.match(/^(\d{1,6})(?:\.(?:json|svg))?$/);
  return m ? Number(m[1]) : NaN;
}

const client = createPublicClient({ chain: chainConfig.chain, transport: http(chainConfig.rpcUrl) });

let cache: { value: number; at: number } | null = null;

/**
 * Number of tokens minted on-chain (cached 20s). Artwork for a token is only
 * served once it exists, so nobody can snipe rare traits before the mint.
 */
export async function mintedCount(): Promise<number> {
  if (!chainConfig.isContractConfigured) return 0;
  if (cache && Date.now() - cache.at < 20_000) return cache.value;
  try {
    const v = await client.readContract({
      address: chainConfig.contractAddress,
      abi: lunettaAbi,
      functionName: "totalMinted",
    });
    cache = { value: Number(v), at: Date.now() };
    return cache.value;
  } catch (err) {
    console.error("[collection] totalMinted failed", err);
    return cache?.value ?? 0;
  }
}

export function baseUrl(req: Request): string {
  // Prefer the configured site URL; fall back to the request origin (preview deploys).
  if (siteConfig.url && !siteConfig.url.includes("localhost")) return siteConfig.url;
  return new URL(req.url).origin;
}

export function metadataFor(token: Token, origin: string) {
  return {
    name: token.name,
    description:
      "A Lunetta: a winged moon-cat who keeps lanterns lit on the floating isles of Halcyra. Every trait becomes an ability in the Lunetta game.",
    image: `${origin}/api/image/${token.id}`,
    external_url: `${origin}/gallery`,
    attributes: [
      ...Object.entries(token.traits).map(([trait_type, value]) => ({ trait_type, value })),
      { trait_type: "Tier", value: token.tier },
      { display_type: "number", trait_type: "Rarity Rank", value: token.rank, max_value: COLLECTION_SIZE },
    ],
  };
}

export function hiddenMetadata(origin: string, id?: number) {
  return {
    name: id ? `Lunetta #${id}` : "Unrevealed Lunetta",
    description: "This keeper is still asleep. It wakes the moment it is minted.",
    image: `${origin}/api/image/hidden`,
    external_url: origin,
    attributes: [{ trait_type: "Status", value: "Sleeping" }],
  };
}
