import type { Metadata } from "next";
import { WhitelistForm } from "./WhitelistForm";
import { LunettaCat, CAT_PALETTES, StarField } from "@/components/illustrations";

export const metadata: Metadata = {
  title: "Whitelist",
  description: "Join the Lunetta whitelist with a free wallet signature for early access to the mint.",
  alternates: { canonical: "/whitelist" },
};

export default function WhitelistPage() {
  return (
    <section className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-ink to-night px-5 pb-32 pt-32">
      <StarField />
      <div className="relative mx-auto grid max-w-5xl items-start gap-12 md:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="font-display text-lg font-semibold text-lantern">Whitelist</p>
          <h1 className="mt-2 font-display text-5xl font-bold leading-tight">Save a lantern for yourself.</h1>
          <p className="mt-5 text-lg leading-relaxed text-paper/80">
            Whitelisted wallets mint first, at a lower price. Joining is free: you only sign a message to prove the wallet is yours.
            No transaction, no gas.
          </p>
          <ul className="mt-6 space-y-2 text-paper/80">
            <li>• One spot per wallet</li>
            <li>• Signing never gives us access to your funds</li>
            <li>• We will never DM you first or ask for your seed phrase</li>
          </ul>
          <LunettaCat palette={CAT_PALETTES.dusk} sleeping className="mt-8 hidden w-48 md:block" />
        </div>
        <WhitelistForm />
      </div>
    </section>
  );
}
