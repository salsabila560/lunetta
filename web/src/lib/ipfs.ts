import { siteConfig } from "./config";

/** Converts ipfs://CID/path (or ipfs://ipfs/CID) to a gateway URL. Leaves https URLs alone. */
export function ipfsToHttp(uri: string | undefined | null): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    const path = uri.replace(/^ipfs:\/\/(ipfs\/)?/, "");
    return `${siteConfig.ipfsGateway}${path}`;
  }
  return uri;
}

export type NftAttribute = { trait_type: string; value: string | number };

export type NftMetadata = {
  name?: string;
  description?: string;
  image?: string;
  attributes?: NftAttribute[];
};

export async function fetchMetadata(uri: string): Promise<NftMetadata> {
  const res = await fetch(ipfsToHttp(uri), { cache: "force-cache" });
  if (!res.ok) throw new Error(`Metadata request failed (${res.status})`);
  return (await res.json()) as NftMetadata;
}
