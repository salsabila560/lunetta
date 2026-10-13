import { getAddress } from "viem";

export const CONNECT_HEADER = "Lunetta World: connect my agent";

/** Message a wallet signs to bind an AI agent to a Lunetta (shared by browser and server). */
export function buildConnectMessage(p: { name: string; tokenId: number | null; address: string; domain: string; issuedAt: string }) {
  return [
    CONNECT_HEADER,
    "",
    "Sign to let an AI agent live in Halcyra as this Lunetta.",
    "Free. Does not send a transaction or move any tokens.",
    "",
    `Domain: ${p.domain}`,
    `Name: ${p.name}`,
    `Lunetta: ${p.tokenId ?? "guest"}`,
    `Wallet: ${getAddress(p.address)}`,
    `Issued at: ${p.issuedAt}`,
  ].join("\n");
}
