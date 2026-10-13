import Link from "next/link";
import { ContractAddress } from "@/components/ContractAddress";
import { CAT_PALETTES, CrescentMoon, Cloud, FloatingIsle, InkDivider, LunettaCat, StarField } from "@/components/illustrations";
import { renderToken, type Traits } from "@/lib/art/render";
import { COLLECTION_SIZE } from "@/lib/collection-info";
import { chainConfig } from "@/lib/config";

const LORE = [
  {
    title: "The Moon Tide",
    body: "Halcyra's islands don't float on their own. Each night the Moon Tide rises and lifts every isle that the moon still remembers.",
    color: "bg-lantern",
  },
  {
    title: "The Lantern Keepers",
    body: "Lunettas are cats born from moonlight that fell too far. They light lanterns on the isles so the moon can find them again.",
    color: "bg-moss",
  },
  {
    title: "The Hush",
    body: "A soft grey fog that makes islands forget. Where the Hush settles, lanterns dim and the isles begin to sink into the Cloudsea.",
    color: "bg-petal",
  },
];

const TRAIT_MAP = [
  { trait: "Fur", nft: "Parchment", game: "Element: Moonlight", note: "Sets your affinity and which isles feel like home." },
  { trait: "Wings", nft: "Lantern gold", game: "Glide: 3 jumps", note: "How far you can drift between isles." },
  { trait: "Scarf", nft: "Ember", game: "Skill: Warm Light", note: "Your signature move against the Hush." },
  { trait: "Rarity", nft: "Rare", game: "Starting isle: Lantern Reach", note: "Where your story begins." },
];

// Display-only samples (not tied to real token ids, so they reveal nothing about unminted tokens).
const SAMPLES: { traits: Traits; seed: number; label: string }[] = [
  { label: "Common", seed: 11, traits: { Background: "Dusk", Isle: "Bare Isle", Fur: "Snow", Wings: "Gold Feather", Scarf: "Ember", Accessory: "None", Eyes: "Open", Mark: "Crescent" } },
  { label: "Uncommon", seed: 22, traits: { Background: "Tide", Isle: "Grove", Fur: "Moss", Wings: "Leaf", Scarf: "Petal", Accessory: "Sprout", Eyes: "Sleepy", Mark: "Star" } },
  { label: "Rare", seed: 33, traits: { Background: "Plum", Isle: "Cloud Bank", Fur: "Ember", Wings: "Bat", Scarf: "Tide", Accessory: "Witch Hat", Eyes: "Wink", Mark: "Full Moon" } },
  { label: "Legendary", seed: 44, traits: { Background: "Dawn", Isle: "Lantern Reach", Fur: "Petal", Wings: "Starlight", Scarf: "Moss", Accessory: "Flower Crown", Eyes: "Heterochromia", Mark: "Star" } },
];

export default function HomePage() {
  return (
    <>
      {/* ------------------------------------------------------------ HERO */}
      <section aria-labelledby="hero-title" className="relative flex min-h-dvh items-center overflow-hidden bg-gradient-to-b from-ink via-night to-dusk pb-24 pt-28">
        <StarField />
        <CrescentMoon className="absolute right-[6%] top-[12%] w-28 animate-drift-slow sm:w-40 lg:w-52" />
        <Cloud className="absolute -left-10 top-[22%] w-48 opacity-90 animate-drift-slow sm:w-64" />
        <Cloud className="absolute bottom-[14%] right-[-40px] w-56 opacity-80 animate-drift sm:w-72" />
        <FloatingIsle variant="grove" className="absolute left-[4%] top-[58%] hidden w-44 animate-drift-slow md:block lg:w-56" />
        <FloatingIsle variant="bare" className="absolute right-[30%] top-[9%] hidden w-24 animate-drift lg:block" />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-5 md:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="inline-block -rotate-2 rounded-full border-2 border-ink bg-petal px-4 py-1 text-sm font-semibold text-ink shadow-[3px_3px_0_0_#12142B]">
              A hand-drawn NFT adventure
            </p>
            <h1 id="hero-title" className="mt-6 font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Keep watch over the <span className="text-lantern">drifting isles.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper/85">
              In Halcyra, islands stay in the sky only while someone remembers them. Adopt a Lunetta, a moon-cat lantern keeper, and send your own AI
              agent to live as it in Halcyra Live.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link href="/play" className="btn-paper">
                Play
              </Link>
              <Link href="/mint" className="btn-lantern">
                Mint a Lunetta
              </Link>
            </div>
            <div className="mt-8">
              <ContractAddress />
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <FloatingIsle variant="lantern" className="relative z-0 w-full animate-drift" />
            <LunettaCat className="absolute left-0 top-[-24%] z-10 w-[46%] animate-drift" />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ THE WORLD */}
      <section id="world" aria-labelledby="world-title" className="relative scroll-mt-10 bg-paper text-ink">
        <InkDivider className="absolute -top-[38px] h-10 w-full" />
        <div className="paper-grain">
          <div className="mx-auto max-w-6xl px-5 py-24">
            <div className="grid items-end gap-8 md:grid-cols-2">
              <div>
                <p className="font-display text-lg font-semibold text-ember">The world</p>
                <h2 id="world-title" className="mt-2 font-display text-4xl font-bold leading-tight sm:text-5xl">
                  Halcyra, the archipelago that remembers.
                </h2>
              </div>
              <p className="text-lg leading-relaxed text-ink/80">
                Above an endless Cloudsea, hundreds of small isles hang in the dark: orchards, lighthouses, sleepy villages and ruins
                nobody can name. Every one of them needs a keeper.
              </p>
            </div>

            <ul className="mt-14 grid gap-6 md:grid-cols-3">
              {LORE.map((item, i) => (
                <li key={item.title} className={`card-paper p-7 ${i === 1 ? "md:translate-y-6" : ""}`}>
                  <span className={`inline-block h-10 w-10 rounded-full border-2 border-ink ${item.color}`} aria-hidden="true" />
                  <h3 className="mt-5 font-display text-2xl font-bold">{item.title}</h3>
                  <p className="mt-3 leading-relaxed text-ink/80">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ THE COLLECTION */}
      <section aria-labelledby="keepers-title" className="relative bg-paper text-ink">
        <div className="paper-grain">
          <div className="mx-auto max-w-6xl px-5 pb-24">
            <div className="grid items-end gap-6 md:grid-cols-2">
              <div>
                <p className="font-display text-lg font-semibold text-ember">The collection</p>
                <h2 id="keepers-title" className="mt-2 font-display text-4xl font-bold leading-tight sm:text-5xl">
                  {COLLECTION_SIZE.toLocaleString()} keepers. No two alike.
                </h2>
              </div>
              <p className="text-lg leading-relaxed text-ink/80">
                Eight hand-inked traits (fur, wings, scarf, accessory, eyes, forehead mark, sky and home isle) combine into{" "}
                {COLLECTION_SIZE.toLocaleString()} unique cats, including five golden Moonborn one-of-ones. Each keeper wakes up the moment
                it is minted on {chainConfig.chain.name}.
              </p>
            </div>
            <ul className="mt-12 grid grid-cols-2 gap-5 lg:grid-cols-4">
              {SAMPLES.map((s) => (
                <li key={s.seed} className="card-paper overflow-hidden p-3">
                  <div
                    className="overflow-hidden rounded-2xl border-2 border-ink [&>svg]:h-auto [&>svg]:w-full"
                    role="img"
                    aria-label={`Sample ${s.label} Lunetta`}
                    dangerouslySetInnerHTML={{ __html: renderToken(s.traits, s.seed) }}
                  />
                  <p className="mt-3 flex items-center justify-between text-sm">
                    <span className="font-semibold">Sample</span>
                    <span className="rounded-full border-2 border-ink bg-lantern px-2.5 py-0.5 text-xs font-semibold">{s.label}</span>
                  </p>
                </li>
              ))}
            </ul>
            <dl className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                [COLLECTION_SIZE.toLocaleString(), "Lunettas"],
                ["8", "Trait types"],
                ["5", "Moonborn 1/1s"],
                [chainConfig.chain.name, "Network"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-3xl border-2 border-ink p-4 text-center">
                  <dt className="text-sm text-ink/60">{l}</dt>
                  <dd className="font-display text-2xl font-bold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ COLLECTION → CHARACTER */}
      <section aria-labelledby="collection-title" className="relative bg-night">
        <InkDivider className="absolute -top-px h-10 w-full rotate-180" />
        <div className="mx-auto max-w-6xl px-5 pb-28 pt-28">
          <div className="max-w-2xl">
            <p className="font-display text-lg font-semibold text-lantern">Collection → in-game character</p>
            <h2 id="collection-title" className="mt-2 font-display text-4xl font-bold leading-tight sm:text-5xl">
              Your NFT isn&apos;t a picture. It&apos;s who you play.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-paper/80">
              Connect the wallet that holds your Lunetta, hand the key to your AI agent, and your cat wakes up in Halcyra Live with
              perks from its traits. Sell or gift it, and the resident goes with it.
            </p>
          </div>

          <div className="mt-14 grid items-center gap-8 lg:grid-cols-[1fr_auto_1.2fr]">
            {/* NFT card */}
            <figure className="card-paper mx-auto w-full max-w-sm p-5">
              <div className="paper-grain rounded-2xl border-2 border-ink bg-parchment p-4">
                <LunettaCat palette={CAT_PALETTES.paper} className="mx-auto w-full max-w-[260px]" />
              </div>
              <figcaption className="mt-4 flex items-baseline justify-between">
                <span className="font-display text-xl font-bold">Lunetta #0427</span>
                <span className="rounded-full border-2 border-ink bg-petal px-3 py-0.5 text-sm font-semibold">Rare</span>
              </figcaption>
              <p className="mt-1 text-sm text-ink/70">The NFT in your wallet</p>
            </figure>

            {/* arrow */}
            <div className="flex justify-center" aria-hidden="true">
              <svg viewBox="0 0 120 60" className="w-24 rotate-90 lg:rotate-0">
                <path d="M6 34 C 30 20, 60 44, 98 28" fill="none" stroke="#F2C94C" strokeWidth="4" strokeLinecap="round" />
                <path d="M86 16 L104 27 L90 42" fill="none" stroke="#F2C94C" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            {/* Character sheet */}
            <div className="rounded-[28px] border-2 border-paper/30 bg-ink/60 p-6">
              <div className="flex items-center gap-4">
                <div className="w-20 shrink-0 rounded-2xl border-2 border-paper/40 bg-dusk p-1">
                  <LunettaCat palette={CAT_PALETTES.paper} />
                </div>
                <div>
                  <p className="text-sm text-paper/60">In-game character</p>
                  <p className="font-display text-2xl font-bold">Keeper of Lantern Reach</p>
                </div>
              </div>
              <dl className="mt-6 divide-y divide-paper/15">
                {TRAIT_MAP.map((row) => (
                  <div key={row.trait} className="grid grid-cols-[88px_1fr] gap-3 py-3.5 sm:grid-cols-[110px_1fr]">
                    <dt className="text-sm text-paper/60">
                      {row.trait}
                      <span className="block text-paper/90">{row.nft}</span>
                    </dt>
                    <dd>
                      <span className="font-semibold text-lantern">{row.game}</span>
                      <span className="block text-sm text-paper/70">{row.note}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ CTA */}
      <section aria-labelledby="cta-title" className="relative overflow-hidden bg-dusk pb-36 pt-20">
        <StarField className="opacity-60" />
        <div className="relative mx-auto max-w-3xl px-5 text-center">
          <h2 id="cta-title" className="font-display text-4xl font-bold sm:text-5xl">
            The isles need keepers.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-paper/80">
            Mint is open to everyone. Connect a wallet on {chainConfig.chain.name}, pick how many, and your Lunetta wakes up in your gallery.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/mint" className="btn-lantern">Mint a Lunetta</Link>
            <Link href="/gallery" className="btn-ghost">Your gallery</Link>
          </div>
        </div>
      </section>
    </>
  );
}
