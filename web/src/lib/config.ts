import { base, baseSepolia, mainnet, sepolia, type Chain } from "viem/chains";
import { getAddress, isAddress, zeroAddress, type Address } from "viem";

const SUPPORTED: Record<number, Chain> = {
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
  [mainnet.id]: mainnet,
  [sepolia.id]: sepolia,
};

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? baseSepolia.id);
const chain = SUPPORTED[chainId];
if (!chain) {
  throw new Error(`NEXT_PUBLIC_CHAIN_ID=${chainId} is not supported. Use one of ${Object.keys(SUPPORTED).join(", ")}.`);
}

const rawAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";
const contractAddress: Address = isAddress(rawAddress) ? getAddress(rawAddress) : zeroAddress;

export const siteConfig = {
  name: "Lunetta",
  tagline: "Keep watch over the drifting isles.",
  description:
    "Lunetta is a hand-drawn fantasy game of moon-cat guardians who keep the floating isles of Halcyra aloft. Mint a Lunetta, and it walks into the game as your character.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  xUrl: process.env.NEXT_PUBLIC_X_URL ?? "",
  discordUrl: process.env.NEXT_PUBLIC_DISCORD_URL ?? "",
  playUrl: process.env.NEXT_PUBLIC_PLAY_URL ?? "",
  ipfsGateway: (process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://ipfs.io/ipfs/").replace(/\/?$/, "/"),
} as const;

export const chainConfig = {
  chain,
  chainId: chain.id,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || chain.rpcUrls.default.http[0],
  contractAddress,
  isContractConfigured: contractAddress !== zeroAddress,
  explorerUrl: chain.blockExplorers?.default.url ?? "",
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
} as const;

export function explorerTx(hash: string) {
  return `${chainConfig.explorerUrl}/tx/${hash}`;
}

export function explorerAddress(address: string) {
  return `${chainConfig.explorerUrl}/address/${address}`;
}
