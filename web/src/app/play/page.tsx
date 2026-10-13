import type { Metadata } from "next";
import { Game } from "./Game";

export const metadata: Metadata = {
  title: "Play Lantern Run",
  description: "Glide between Halcyra's floating isles, light lanterns and chase away the Hush. Play as your own Lunetta.",
  alternates: { canonical: "/play" },
};

export default function PlayPage() {
  return (
    <section className="min-h-dvh bg-gradient-to-b from-ink to-night px-4 pb-24 pt-28 sm:px-5">
      <div className="mx-auto max-w-5xl">
        <p className="font-display text-lg font-semibold text-lantern">Play</p>
        <h1 className="mt-1 font-display text-4xl font-bold sm:text-5xl">Lantern Run</h1>
        <p className="mt-2 max-w-2xl text-paper/80">
          Glide from isle to isle, light every lantern you pass and keep the Hush away. Your Lunetta&apos;s traits decide how it plays.
        </p>
        <div className="mt-6">
          <Game />
        </div>
      </div>
    </section>
  );
}
