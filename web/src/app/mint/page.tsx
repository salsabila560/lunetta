import type { Metadata } from "next";
import { MintPanel } from "./MintPanel";
import { FloatingIsle, LunettaCat, CAT_PALETTES, StarField } from "@/components/illustrations";

export const metadata: Metadata = {
  title: "Mint",
  description: "Mint your Lunetta moon-cat. Public mint, live supply, and every payment burned.",
  alternates: { canonical: "/mint" },
};

export default function MintPage() {
  return (
    <section className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-ink via-night to-dusk px-5 pb-32 pt-32">
      <StarField />
      <div className="relative mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-[1fr_1.15fr]">
        <div className="relative mx-auto hidden w-full max-w-sm md:block" aria-hidden="true">
          <FloatingIsle variant="bare" className="w-full animate-drift" />
          <LunettaCat palette={CAT_PALETTES.ember} className="absolute left-[24%] top-[-30%] w-[52%] animate-drift" />
        </div>
        <div>
          <h1 className="font-display text-5xl font-bold leading-tight">Mint a Lunetta</h1>
          <p className="mt-3 text-lg text-paper/80">Each one is a playable keeper. Traits are revealed after the mint.</p>
          <div className="mt-8">
            <MintPanel />
          </div>
        </div>
      </div>
    </section>
  );
}
