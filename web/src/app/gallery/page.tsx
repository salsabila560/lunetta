import type { Metadata } from "next";
import { Gallery } from "./Gallery";

export const metadata: Metadata = {
  title: "Your gallery",
  description: "See the Lunetta moon-cats held by your connected wallet.",
  alternates: { canonical: "/gallery" },
  robots: { index: false },
};

export default function GalleryPage() {
  return (
    <section className="min-h-dvh bg-gradient-to-b from-ink to-night px-5 pb-32 pt-32">
      <div className="mx-auto max-w-6xl">
        <p className="font-display text-lg font-semibold text-lantern">Gallery</p>
        <h1 className="mt-2 font-display text-5xl font-bold">Your keepers</h1>
        <p className="mt-3 max-w-xl text-lg text-paper/80">Every Lunetta in your connected wallet. These are the characters you&apos;ll play.</p>
        <div className="mt-10">
          <Gallery />
        </div>
      </div>
    </section>
  );
}
