import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { chainConfig, siteConfig } from "./config";

export const wagmiConfig = getDefaultConfig({
  appName: siteConfig.name,
  appDescription: siteConfig.description,
  appUrl: siteConfig.url,
  // RainbowKit requires a non-empty id; WalletConnect wallets fail until a real one is set.
  projectId: chainConfig.walletConnectProjectId || "MISSING_WALLETCONNECT_PROJECT_ID",
  chains: [chainConfig.chain],
  transports: { [chainConfig.chain.id]: http(chainConfig.rpcUrl) },
  ssr: true,
});

export const lunettaContract = {
  address: chainConfig.contractAddress,
  chainId: chainConfig.chainId,
} as const;
