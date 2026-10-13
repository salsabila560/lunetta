"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { chainConfig } from "@/lib/config";
import { wagmiConfig } from "@/lib/wagmi";

const theme = darkTheme({
  accentColor: "#F2C94C",
  accentColorForeground: "#12142B",
  borderRadius: "large",
  fontStack: "system",
  overlayBlur: "small",
});
theme.colors.modalBackground = "#1C2052";
theme.fonts.body = "Figtree, system-ui, sans-serif";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: false } } }),
  );
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} initialChain={chainConfig.chain} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
