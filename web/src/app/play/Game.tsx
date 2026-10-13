"use client";

import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { WalletButton } from "@/components/WalletButton";
import { lunettaAbi } from "@/lib/abi";
import { renderCat, type Traits } from "@/lib/art/render";
import { chainConfig } from "@/lib/config";
import { LanternRun, type Hud } from "@/lib/game/engine";
import { GUEST_TRAITS, statsFor } from "@/lib/game/stats";
import { lunettaContract } from "@/lib/wagmi";

type Character = { key: string; name: string; traits: Traits };

const SKY: Record<string, string> = {
  Midnight: "#12142B",
  Dusk: "#2E3274",
  Tide: "#3E4A9A",
  Plum: "#4A2C5E",
  Parchment: "#2E3274",
  Dawn: "#4A2C5E",
};

const TRAIT_KEYS = ["Background", "Isle", "Fur", "Wings", "Scarf", "Accessory", "Eyes", "Mark"] as const;
const BEST_KEY = "lunetta:lantern-run:best";

function readBest(): number {
  try {
    return Number(window.localStorage.getItem(BEST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function writeBest(v: number) {
  try {
    window.localStorage.setItem(BEST_KEY, String(v));
  } catch {
    /* storage unavailable */
  }
}

function catDataUrl(traits: Traits) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderCat(traits))}`;
}

function useOwnedCharacters(): { characters: Character[]; loading: boolean } {
  const { address } = useAccount();
  const owned = useReadContract({
    ...lunettaContract,
    abi: lunettaAbi,
    functionName: "tokensOfOwner",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) && chainConfig.isContractConfigured },
  });
  const ids = (owned.data ?? []).slice(0, 24);
  const metas = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["game-meta", id.toString()],
      queryFn: async () => {
        const res = await fetch(`/api/metadata/${id.toString()}.json`);
        if (!res.ok) throw new Error("metadata");
        return (await res.json()) as { name?: string; attributes?: { trait_type: string; value: string | number }[] };
      },
      staleTime: 10 * 60_000,
    })),
  });
  const characters: Character[] = [];
  metas.forEach((m, i) => {
    const attrs = m.data?.attributes;
    if (!attrs) return;
    const t: Partial<Record<(typeof TRAIT_KEYS)[number], string>> = {};
    for (const a of attrs) if ((TRAIT_KEYS as readonly string[]).includes(a.trait_type)) t[a.trait_type as (typeof TRAIT_KEYS)[number]] = String(a.value);
    if (TRAIT_KEYS.every((k) => t[k])) {
      characters.push({ key: ids[i].toString(), name: m.data?.name ?? `Lunetta #${ids[i].toString()}`, traits: t as Traits });
    }
  });
  return { characters, loading: owned.isLoading || metas.some((m) => m.isLoading) };
}

export function Game() {
  const { isConnected } = useAccount();
  const { characters: owned, loading } = useOwnedCharacters();
  const guest: Character = useMemo(() => ({ key: "guest", name: "Wanderer (guest)", traits: GUEST_TRAITS }), []);
  const characters = useMemo(() => [...owned, guest], [owned, guest]);

  const [selectedKey, setSelectedKey] = useState("guest");
  const selected = characters.find((c) => c.key === selectedKey) ?? guest;
  useEffect(() => {
    // auto-select the player's first Lunetta once it loads
    if (owned.length > 0 && selectedKey === "guest") setSelectedKey(owned[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owned.length]);

  const [screen, setScreen] = useState<"select" | "play">("select");
  const [hud, setHud] = useState<Hud | null>(null);
  const [best, setBest] = useState(0);
  const [runId, setRunId] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<LanternRun | null>(null);

  useEffect(() => setBest(readBest()), []);

  const stop = useCallback(() => {
    engineRef.current?.destroy();
    engineRef.current = null;
  }, []);

  const startRun = useCallback(() => {
    stop();
    setHud(null);
    setScreen("play");
    setRunId((n) => n + 1);
  }, [stop]);

  // Boot the engine once the play screen (and its canvas) is mounted.
  useEffect(() => {
    if (screen !== "play") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const { stats } = statsFor(selected.traits);
      const engine = new LanternRun(canvas, img, stats, SKY[selected.traits.Background] ?? SKY.Midnight, (h) => {
        setHud(h);
        if (h.over) {
          setBest((b) => {
            const nb = Math.max(b, h.score);
            writeBest(nb);
            return nb;
          });
        }
      });
      engineRef.current = engine;
      engine.start();
    };
    img.src = catDataUrl(selected.traits);

    const ro = new ResizeObserver(() => engineRef.current?.resize());
    ro.observe(canvas);
    const onVis = () => (document.hidden ? engineRef.current?.pause() : engineRef.current?.start());
    document.addEventListener("visibilitychange", onVis);

    const isJump = (e: KeyboardEvent) => e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW";
    const down = (e: KeyboardEvent) => {
      if (isJump(e)) {
        e.preventDefault();
        if (!e.repeat) engineRef.current?.press();
      } else if (e.code === "KeyE" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
        engineRef.current?.skill();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (isJump(e)) engineRef.current?.release();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    return () => {
      cancelled = true;
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      engineRef.current?.destroy();
      engineRef.current = null;
    };
    // selected.traits is stable for the duration of a run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, runId]);

  const { lines } = statsFor(selected.traits);

  if (screen === "select") {
    return (
      <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
        <div className="card-paper p-5">
          <div className="paper-grain flex justify-center rounded-2xl border-2 border-ink bg-dusk p-4">
            <div
              className="w-44 [&>svg]:h-auto [&>svg]:w-full"
              role="img"
              aria-label={selected.name}
              dangerouslySetInnerHTML={{ __html: renderCat(selected.traits) }}
            />
          </div>
          <p className="mt-4 font-display text-2xl font-bold">{selected.name}</p>
          <dl className="mt-3 space-y-2 text-sm">
            {lines.map((l) => (
              <div key={l.trait + l.effect} className="flex justify-between gap-3 border-b border-ink/10 pb-2">
                <dt className="text-ink/60">
                  {l.trait}: <span className="text-ink">{l.value}</span>
                </dt>
                <dd className="text-right font-semibold">{l.effect}</dd>
              </div>
            ))}
          </dl>
          <button className="btn-lantern mt-6 w-full" onClick={startRun}>
            Play
          </button>
          {best > 0 && <p className="mt-3 text-center text-sm text-ink/60">Best score: {best.toLocaleString()}</p>}
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border-2 border-paper/25 bg-ink/50 p-5">
            <p className="font-display text-xl font-bold">Choose your keeper</p>
            <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {characters.map((c) => (
                <li key={c.key}>
                  <button
                    onClick={() => setSelectedKey(c.key)}
                    aria-pressed={c.key === selected.key}
                    className={`w-full rounded-2xl border-2 p-2 transition ${c.key === selected.key ? "border-lantern bg-dusk" : "border-paper/20 hover:border-paper/50"}`}
                  >
                    <div className="[&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: renderCat(c.traits) }} />
                    <span className="mt-1 block truncate text-xs">{c.key === "guest" ? "Guest" : `#${c.key}`}</span>
                  </button>
                </li>
              ))}
            </ul>
            {!isConnected ? (
              <div className="mt-5">
                <p className="mb-3 text-sm text-paper/75">Connect your wallet to play as your own Lunettas.</p>
                <WalletButton />
              </div>
            ) : loading ? (
              <p className="mt-4 text-sm text-paper/70">Looking for your Lunettas…</p>
            ) : owned.length === 0 ? (
              <p className="mt-4 text-sm text-paper/75">
                No Lunettas in this wallet yet. <Link href="/mint" className="text-lantern underline">Mint one</Link> to play with its traits.
              </p>
            ) : null}
          </div>
          <div className="rounded-[28px] border-2 border-paper/25 bg-ink/50 p-5 text-sm text-paper/80">
            <p className="font-display text-lg font-bold text-paper">How to play</p>
            <ul className="mt-2 space-y-1">
              <li>• Tap, click or press Space to jump. Jump again in the air if your wings allow.</li>
              <li>• Hold to glide.</li>
              <li>• Land on isles or fly past lanterns to light them. Grab stars between isles.</li>
              <li>• Grey fog is the Hush. Avoid it, or use Warm Light (button or E) to clear it.</li>
              <li>• Falling into the Cloudsea or touching the Hush costs a life.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const over = hud?.over ?? false;
  return (
    <div className="relative overflow-hidden rounded-[28px] border-2 border-ink shadow-[6px_6px_0_0_#000]">
      <canvas
        ref={canvasRef}
        className="block h-[min(70dvh,520px)] w-full touch-none select-none"
        aria-label="Lantern Run game. Tap to jump, hold to glide."
        onPointerDown={(e) => {
          e.preventDefault();
          engineRef.current?.press();
        }}
        onPointerUp={() => engineRef.current?.release()}
        onPointerLeave={() => engineRef.current?.release()}
        onPointerCancel={() => engineRef.current?.release()}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 sm:p-4">
        <div className="rounded-2xl bg-ink/70 px-3 py-2">
          <p className="font-display text-2xl font-bold tabular-nums">{(hud?.score ?? 0).toLocaleString()}</p>
          <p className="text-xs text-paper/70">{hud?.lanterns ?? 0} lanterns · {hud?.distance ?? 0} m</p>
        </div>
        <div className="flex gap-1 rounded-2xl bg-ink/70 px-3 py-2" aria-label={`${hud?.lives ?? 0} lives`}>
          {Array.from({ length: hud?.maxLives ?? statsFor(selected.traits).stats.lives }).map((_, i) => (
            <span key={i} className={`h-3.5 w-3.5 rounded-full border-2 border-paper ${i < (hud?.lives ?? 99) ? "bg-lantern" : "bg-transparent"}`} />
          ))}
        </div>
      </div>

      {!over && (
        <button
          className="absolute bottom-4 right-4 h-20 w-20 rounded-full border-2 border-ink bg-lantern font-display text-sm font-bold text-ink shadow-[3px_3px_0_0_#12142B] disabled:bg-parchment"
          style={{ opacity: (hud?.skillReady ?? 1) >= 1 ? 1 : 0.6 }}
          onPointerDown={(e) => {
            e.stopPropagation();
            engineRef.current?.skill();
          }}
          aria-label="Warm Light"
        >
          {(hud?.skillReady ?? 1) >= 1 ? "Warm Light" : `${Math.round((hud?.skillReady ?? 0) * 100)}%`}
        </button>
      )}

      {over && hud && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/70 p-4">
          <div className="card-paper w-full max-w-sm p-6 text-center">
            <p className="font-display text-3xl font-bold">The Hush settles…</p>
            <p className="mt-3 font-display text-5xl font-bold tabular-nums">{hud.score.toLocaleString()}</p>
            <p className="mt-1 text-sm text-ink/70">
              {hud.lanterns} lanterns lit · {hud.distance} m · best {best.toLocaleString()}
            </p>
            <div className="mt-6 grid gap-3">
              <button className="btn-lantern w-full" onClick={startRun}>
                Play again
              </button>
              <button
                className="btn-paper w-full"
                onClick={() => {
                  stop();
                  setScreen("select");
                }}
              >
                Change keeper
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
