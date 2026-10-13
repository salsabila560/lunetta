import { base, baseSepolia, mainnet, sepolia, type Chain } from "viem/chains";
import { defineChain, getAddress, isAddress, zeroAddress, type Address } from "viem";
import deployment from "../../data/deployment.json";

// Network details from docs.robinhood.com/chain/connecting
export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" } },
});

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Explorer", url: "https://explorer.testnet.chain.robinhood.com" } },
  testnet: true,
});

const SUPPORTED: Record<number, Chain> = {
  [robinhoodChain.id]: robinhoodChain,
  [robinhoodTestnet.id]: robinhoodTestnet,
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
  [mainnet.id]: mainnet,
  [sepolia.id]: sepolia,
};

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || robinhoodChain.id);
const chain = SUPPORTED[chainId];
if (!chain) {
  throw new Error(`NEXT_PUBLIC_CHAIN_ID=${chainId} is not supported. Use one of ${Object.keys(SUPPORTED).join(", ")}.`);
}

// Contract address: env var wins; otherwise data/deployment.json (committed after deploying
// from /admin) is used when it matches the configured chain.
const envAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";
const rawAddress =
  (isAddress(envAddress) && envAddress !== zeroAddress ? envAddress : "") ||
  (deployment.chainId === chainId ? deployment.address : "");
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
