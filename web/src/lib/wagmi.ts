import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { chainConfig, siteConfig } from "./config";

const projectId = chainConfig.walletConnectProjectId;

// Explicit wallet list instead of getDefaultConfig: it avoids the Base Account
// connector (whose @coinbase/cdp-sdk dependency breaks the Next.js build) and
// lets the site work before a WalletConnect project id is configured.
const connectors = connectorsForWallets(
  [
    {
      groupName: "Wallets",
      wallets: projectId
        ? [metaMaskWallet, rainbowWallet, coinbaseWallet, walletConnectWallet, injectedWallet]
        : [injectedWallet, coinbaseWallet],
    },
  ],
  {
    appName: siteConfig.name,
    appDescription: siteConfig.description,
    appUrl: siteConfig.url,
    projectId: projectId || "walletconnect-disabled",
  },
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [chainConfig.chain],
  transports: { [chainConfig.chain.id]: http(chainConfig.rpcUrl) },
  ssr: true,
});

export const lunettaContract = {
  address: chainConfig.contractAddress,
  chainId: chainConfig.chainId,
} as const;
