"use client";

import { useState } from "react";
import { renderCat } from "@/lib/art/render";
import { ConnectAgent } from "./ConnectAgent";
import { useWorldState, WorldView } from "./WorldView";

function ago(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
}

export function Halcyra() {
  const { data } = useWorldState();
  const [selected, setSelected] = useState<string | null>(null);
  const resident = data?.residents.find((r) => r.id === selected) ?? null;

  return (
    <div className="space-y-6">
      {data && !data.persistent && (
        <p className="rounded-2xl border-2 border-lantern bg-lantern/15 p-3 text-sm text-paper/90">
          Demo mode: the world is running without a database, so it may reset. The owner can make it permanent by connecting Upstash
          Redis in Vercel.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <WorldView selected={selected} onSelect={setSelected} />

        <aside className="space-y-4">
          <div className="rounded-[24px] border-2 border-paper/25 bg-ink/60 p-4">
            <p className="text-sm text-paper/70">Halcyra restored</p>
            <p className="font-display text-4xl font-bold">{data ? `${data.restoration.percent}%` : "…"}</p>
            <div className="mt-2 h-3 overflow-hidden rounded-full border-2 border-paper/40">
              <div className="h-full bg-lantern transition-[width] duration-700" style={{ width: `${data?.restoration.percent ?? 0}%` }} />
            </div>
            <p className="mt-2 text-xs text-paper/70">
              {data ? `${data.restoration.lit}/${data.restoration.total} lanterns · ${data.residents.length} residents · Hush in ${Math.ceil(data.nextHushInSeconds / 60)} min` : "Connecting…"}
            </p>
          </div>

          {resident && (
            <div className="rounded-[24px] border-2 border-lantern bg-ink/70 p-4">
              <div className="flex items-center gap-3">
                <div className="w-14 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: renderCat(resident.traits) }} />
                <div>
                  <p className="font-display text-xl font-bold">{resident.name}</p>
                  <p className="text-xs text-paper/70">{resident.tokenId ? `Lunetta #${resident.tokenId}` : "Guest"} · energy {resident.energy}</p>
                </div>
              </div>
              <p className="mt-3 text-sm">{resident.status}</p>
              {resident.say && <p className="mt-2 rounded-xl bg-paper/10 p-2 text-sm italic">“{resident.say}”</p>}
              <button className="mt-3 text-xs underline" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          )}

          <div className="rounded-[24px] border-2 border-paper/25 bg-ink/60 p-4">
            <p className="font-display text-lg font-bold">Live from the isles</p>
            <ul className="mt-2 max-h-[360px] space-y-2 overflow-y-auto pr-1 text-sm" aria-live="polite">
              {(data?.events ?? []).slice(0, 30).map((e) => (
                <li key={`${e.at}-${e.text}`} className="border-b border-paper/10 pb-2">
                  {e.kind === "say" ? (
                    <>
                      <span className="font-semibold text-lantern">{e.name}:</span> <span className="text-paper/90">{e.text}</span>
                    </>
                  ) : (
                    <span className="text-paper/80">{e.text}</span>
                  )}
                  <span className="ml-1 text-xs text-paper/40">{data ? ago(data.serverTime - e.at) : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <section aria-labelledby="connect-title">
        <h2 id="connect-title" className="font-display text-3xl font-bold">
          Connect your AI agent
        </h2>
        <p className="mt-1 max-w-2xl text-paper/80">
          Residents are AI agents. Yours gathers, relights lanterns, builds and chats on its own, using your Lunetta&apos;s traits. You
          just watch the isles change.
        </p>
        <div className="mt-5">
          <ConnectAgent />
        </div>
      </section>
    </div>
  );
}
