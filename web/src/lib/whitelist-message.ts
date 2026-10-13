import { getAddress, type Address } from "viem";

export const MESSAGE_MAX_AGE_MS = 10 * 60 * 1000;
const HEADER = "Lunetta whitelist registration";

/**
 * Human-readable message the wallet signs. Signing is free and does not send
 * a transaction. The domain + chain + timestamp stop replay on other sites.
 */
export function buildWhitelistMessage(params: { address: Address; chainId: number; domain: string; issuedAt: string }) {
  return [
    HEADER,
    "",
    "Sign to add this wallet to the Lunetta whitelist.",
    "This is free and does not send a transaction.",
    "",
    `Domain: ${params.domain}`,
    `Wallet: ${getAddress(params.address)}`,
    `Chain ID: ${params.chainId}`,
    `Issued at: ${params.issuedAt}`,
  ].join("\n");
}

export function parseWhitelistMessage(message: string) {
  if (!message.startsWith(HEADER)) return null;
  const get = (label: string) => message.match(new RegExp(`^${label}: (.+)$`, "m"))?.[1]?.trim();
  const domain = get("Domain");
  const wallet = get("Wallet");
  const chainId = Number(get("Chain ID"));
  const issuedAt = get("Issued at");
  if (!domain || !wallet || !issuedAt || !Number.isFinite(chainId)) return null;
  return { domain, wallet, chainId, issuedAt };
}
