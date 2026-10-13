"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { renderCat, type Traits } from "@/lib/art/render";

export type PublicIsle = {
  id: string;
  name: string;
  x: number;
  y: number;
  size: number;
  resource: string;
  lanterns: number;
  lit: number;
  blurb: string;
  structures: { kind: string; by: string; to?: string }[];
};
export type PublicResident = {
  id: string;
  name: string;
  tokenId: number | null;
  traits: Traits;
  isle: string;
  fromIsle: string | null;
  movedAgo: number | null;
  status: string;
  say: string | null;
  energy: number;
  actions: number;
};
export type WorldState = {
  serverTime: number;
  persistent: boolean;
  restoration: { lit: number; total: number; percent: number };
  nextHushInSeconds: number;
  isles: PublicIsle[];
  residents: PublicResident[];
  events: { at: number; kind: string; name?: string; text: string }[];
};

const MAP_W = 1000;
const MAP_H = 600;
const INK = "#12142B";
const PAPER = "#F3ECDC";
const LANTERN = "#F2C94C";
const MOSS = "#5DCAA5";
const TIDE = "#3E4A9A";
const GLIDE_MS = 4000;

const ISLE_ROCK = "M22 86 C 52 116, 92 168, 126 182 C 140 200, 166 206, 178 190 C 214 170, 262 126, 300 88 Z";
const ISLE_GRASS = "M18 84 C 34 66, 98 58, 158 60 C 222 58, 288 64, 304 84 C 270 96, 54 98, 18 84 Z";

export function useWorldState() {
  return useQuery<WorldState>({
    queryKey: ["world-state"],
    queryFn: async () => {
      const res = await fetch("/api/world/state", { cache: "no-store" });
      if (!res.ok) throw new Error("Couldn't reach Halcyra.");
      return (await res.json()) as WorldState;
    },
    refetchInterval: 4000,
    refetchOnWindowFocus: true,
  });
}

function spriteFor(cache: Map<string, HTMLImageElement>, traits: Traits) {
  const key = JSON.stringify(traits);
  let img = cache.get(key);
  if (!img) {
    img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderCat(traits))}`;
    cache.set(key, img);
  }
  return img;
}

/** Where a resident stands on an isle (map coords, feet position). */
function standPoint(isle: PublicIsle, index: number, count: number) {
  const span = isle.size * 0.62;
  const step = count > 1 ? span / (count - 1) : 0;
  const x = isle.x - span / 2 + step * index + (count === 1 ? span / 2 : 0);
  return { x, y: isle.y - isle.size * 0.04 };
}

export function WorldView({ selected, onSelect }: { selected: string | null; onSelect: (id: string | null) => void }) {
  const { data, isError } = useWorldState();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<{ state: WorldState; receivedAt: number } | null>(null);
  const hitsRef = useRef<{ id: string; x: number; y: number }[]>([]);
  const selectedRef = useRef<string | null>(selected);
  const [, force] = useState(0);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    if (data) dataRef.current = { state: data, receivedAt: performance.now() };
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sprites = new Map<string, HTMLImageElement>();
    const rock = new Path2D(ISLE_ROCK);
    const grass = new Path2D(ISLE_GRASS);
    const stars = Array.from({ length: 90 }, () => ({ x: Math.random() * MAP_W, y: Math.random() * MAP_H, r: 0.6 + Math.random() * 1.6, p: Math.random() * 6 }));
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (tms: number) => {
      const scale = canvas.width / MAP_W;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      const t = tms / 1000;
      // sky
      const g = ctx.createLinearGradient(0, 0, 0, MAP_H);
      g.addColorStop(0, "#12142B");
      g.addColorStop(1, "#2E3274");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, MAP_W, MAP_H);
      for (const s of stars) {
        ctx.globalAlpha = 0.45 + 0.45 * Math.sin(t * 1.3 + s.p);
        ctx.fillStyle = s.r > 1.6 ? LANTERN : PAPER;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // moon
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(930, 70, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#151838";
      ctx.beginPath();
      ctx.arc(944, 60, 30, 0, Math.PI * 2);
      ctx.fill();
      // cloudsea
      ctx.fillStyle = "rgba(243,236,220,0.06)";
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.arc(((i * 130 + t * 6) % (MAP_W + 200)) - 100, MAP_H + 10, 90, 0, Math.PI * 2);
        ctx.fill();
      }

      const snap = dataRef.current;
      const hits: { id: string; x: number; y: number }[] = [];
      if (snap) {
        const { state, receivedAt } = snap;
        const elapsed = performance.now() - receivedAt;
        const isleById = new Map(state.isles.map((i) => [i.id, i]));

        // bridges
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = "rgba(243,236,220,0.55)";
        ctx.lineWidth = 2;
        for (const isle of state.isles) {
          for (const s of isle.structures) {
            const to = s.kind === "bridge" && s.to ? isleById.get(s.to) : null;
            if (!to) continue;
            ctx.beginPath();
            ctx.moveTo(isle.x, isle.y);
            ctx.quadraticCurveTo((isle.x + to.x) / 2, Math.min(isle.y, to.y) - 60, to.x, to.y);
            ctx.stroke();
          }
        }
        ctx.setLineDash([]);

        // isles
        for (const isle of state.isles) {
          const k = isle.size / 300;
          const bob = Math.sin(t * 0.6 + isle.x) * 3;
          ctx.save();
          ctx.translate(isle.x - isle.size / 2, isle.y - 62 * k + bob);
          ctx.scale(k, k);
          ctx.save();
          ctx.translate(3, 2);
          ctx.fillStyle = TIDE;
          ctx.fill(rock);
          ctx.fillStyle = MOSS;
          ctx.fill(grass);
          ctx.restore();
          ctx.strokeStyle = INK;
          ctx.lineWidth = 2.4 / k;
          ctx.stroke(rock);
          ctx.stroke(grass);
          ctx.restore();

          // lanterns along the grass
          for (let i = 0; i < isle.lanterns; i++) {
            const lx = isle.x - isle.size * 0.38 + (isle.size * 0.76 * i) / Math.max(1, isle.lanterns - 1);
            const ly = isle.y - isle.size * 0.02 + bob;
            const lit = i < isle.lit;
            if (lit) {
              ctx.fillStyle = "rgba(242,201,76,0.25)";
              ctx.beginPath();
              ctx.arc(lx, ly - 4, 9 + Math.sin(t * 3 + i) * 1.5, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = lit ? LANTERN : "#4B4A57";
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.2;
            ctx.fillRect(lx - 3, ly - 8, 6, 8);
            ctx.strokeRect(lx - 3, ly - 8, 6, 8);
          }

          // structures (icons in a row under the isle name)
          isle.structures
            .filter((s) => s.kind !== "bridge")
            .forEach((s, i) => {
              const sx = isle.x + isle.size * 0.28 - i * 16;
              const sy = isle.y - isle.size * 0.06 + bob - 10;
              ctx.strokeStyle = INK;
              ctx.lineWidth = 1.5;
              if (s.kind === "hut") {
                ctx.fillStyle = "#E7DCC2";
                ctx.fillRect(sx - 6, sy - 6, 12, 10);
                ctx.strokeRect(sx - 6, sy - 6, 12, 10);
                ctx.fillStyle = "#E8704A";
                ctx.beginPath();
                ctx.moveTo(sx - 9, sy - 6);
                ctx.lineTo(sx, sy - 15);
                ctx.lineTo(sx + 9, sy - 6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
              } else if (s.kind === "lamp") {
                ctx.strokeStyle = PAPER;
                ctx.beginPath();
                ctx.moveTo(sx, sy + 4);
                ctx.lineTo(sx, sy - 14);
                ctx.stroke();
                ctx.fillStyle = LANTERN;
                ctx.beginPath();
                ctx.arc(sx, sy - 16, 4, 0, Math.PI * 2);
                ctx.fill();
              } else if (s.kind === "garden") {
                for (const [dx, c] of [[-5, "#F4A0BC"], [0, LANTERN], [5, "#F4A0BC"]] as const) {
                  ctx.fillStyle = c;
                  ctx.beginPath();
                  ctx.arc(sx + dx, sy - 4, 3.5, 0, Math.PI * 2);
                  ctx.fill();
                }
              }
            });

          // darkness / Hush over unlit isles
          if (isle.lit === 0) {
            ctx.fillStyle = "rgba(185,180,168,0.35)";
            for (let i = 0; i < 3; i++) {
              ctx.beginPath();
              ctx.arc(isle.x - 30 + i * 30 + Math.sin(t + i) * 6, isle.y - 30 + Math.cos(t * 0.8 + i) * 4, 24, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // label
          ctx.font = "600 15px Figtree, system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillStyle = PAPER;
          ctx.fillText(isle.name, isle.x, isle.y + isle.size * 0.42 + bob);
          ctx.font = "12px Figtree, system-ui, sans-serif";
          ctx.fillStyle = "rgba(243,236,220,0.7)";
          ctx.fillText(`${isle.lit}/${isle.lanterns} lanterns · ${isle.resource}`, isle.x, isle.y + isle.size * 0.42 + 16 + bob);
        }

        // residents
        const byIsle = new Map<string, PublicResident[]>();
        for (const r of state.residents) byIsle.set(r.isle, [...(byIsle.get(r.isle) ?? []), r]);
        for (const [isleId, rs] of byIsle) {
          const isle = isleById.get(isleId);
          if (!isle) continue;
          rs.forEach((r, idx) => {
            let { x, y } = standPoint(isle, idx, rs.length);
            const moved = r.movedAgo !== null ? r.movedAgo + elapsed : Infinity;
            const from = r.fromIsle ? isleById.get(r.fromIsle) : null;
            if (from && moved < GLIDE_MS) {
              const f = moved / GLIDE_MS;
              const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
              const sx = from.x;
              const sy = from.y - from.size * 0.04;
              x = sx + (x - sx) * e;
              y = sy + (y - sy) * e - Math.sin(Math.PI * f) * 90;
            }
            const size = 46;
            const img = spriteFor(sprites, r.traits);
            const yb = y + Math.sin(t * 2 + idx) * 1.5;
            if (selectedRef.current === r.id) {
              ctx.strokeStyle = LANTERN;
              ctx.lineWidth = 2.5;
              ctx.beginPath();
              ctx.ellipse(x, y + 2, 20, 6, 0, 0, Math.PI * 2);
              ctx.stroke();
            }
            if (img.complete && img.naturalWidth) ctx.drawImage(img, x - (size * 240) / 270 / 2, yb - size * (236 / 270), (size * 240) / 270, size);
            ctx.font = "600 11px Figtree, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillStyle = PAPER;
            ctx.fillText(r.name, x, y + 14);
            hits.push({ id: r.id, x, y: yb - size / 2 });

            if (r.say) {
              const text = r.say.length > 48 ? `${r.say.slice(0, 46)}…` : r.say;
              ctx.font = "12px Figtree, system-ui, sans-serif";
              const w = Math.min(220, ctx.measureText(text).width + 16);
              const bx = Math.max(4, Math.min(MAP_W - w - 4, x - w / 2));
              const by = yb - size - 30;
              ctx.fillStyle = PAPER;
              ctx.strokeStyle = INK;
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.roundRect(bx, by, w, 22, 8);
              ctx.fill();
              ctx.stroke();
              ctx.fillStyle = INK;
              ctx.textAlign = "left";
              ctx.fillText(text, bx + 8, by + 15, w - 16);
            }
          });
        }
      }
      hitsRef.current = hits;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-[28px] border-2 border-ink shadow-[6px_6px_0_0_#000]">
      <canvas
        ref={canvasRef}
        className="block aspect-[5/3] w-full cursor-pointer"
        aria-label="Live map of Halcyra with AI residents"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const mx = ((e.clientX - rect.left) / rect.width) * MAP_W;
          const my = ((e.clientY - rect.top) / rect.height) * MAP_H;
          let best: string | null = null;
          let bd = 40;
          for (const h of hitsRef.current) {
            const d = Math.hypot(h.x - mx, h.y - my);
            if (d < bd) {
              bd = d;
              best = h.id;
            }
          }
          onSelect(best);
        }}
      />
      {isError && (
        <p className="absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-ember px-4 py-1 text-sm font-semibold text-ink">Reconnecting to Halcyra…</p>
      )}
      {data && data.residents.length === 0 && (
        <p className="absolute inset-x-0 bottom-4 mx-auto w-fit max-w-[90%] rounded-2xl bg-ink/80 px-4 py-2 text-center text-sm">
          No residents yet. Send the first AI agent to Halcyra below.
        </p>
      )}
    </div>
  );
}
