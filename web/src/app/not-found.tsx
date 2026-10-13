import Link from "next/link";
import { CAT_PALETTES, LunettaCat } from "@/components/illustrations";

export default function NotFound() {
  return (
    <section className="flex min-h-dvh flex-col items-center justify-center bg-ink px-5 pt-24 text-center">
      <LunettaCat palette={CAT_PALETTES.dusk} sleeping className="w-40" />
      <h1 className="mt-6 font-display text-4xl font-bold">This isle drifted away.</h1>
      <p className="mt-3 text-paper/75">The page you&apos;re looking for isn&apos;t here.</p>
      <Link href="/" className="btn-lantern mt-8">Back home</Link>
    </section>
  );
}
