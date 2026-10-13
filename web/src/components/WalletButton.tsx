"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

/** RainbowKit connect button restyled to match the hand-inked buttons. */
export function WalletButton({ size = "md" }: { size?: "md" | "lg" }) {
  const base = size === "lg" ? "btn-lantern w-full" : "btn-lantern !min-h-[42px] !px-5 !py-2 !text-base";
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted, authenticationStatus }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected = ready && account && chain;
        return (
          <div aria-hidden={!ready} className={ready ? "" : "pointer-events-none select-none opacity-0"}>
            {!connected ? (
              <button type="button" onClick={openConnectModal} className={base}>
                Connect wallet
              </button>
            ) : chain.unsupported ? (
              <button type="button" onClick={openChainModal} className={`${base} !bg-ember`}>
                Wrong network
              </button>
            ) : (
              <button type="button" onClick={openAccountModal} className={base.replace("btn-lantern", "btn-paper")}>
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-moss" aria-hidden="true" />
                {account.displayName}
              </button>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
