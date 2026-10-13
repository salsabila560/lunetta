import type { Resource } from "./types";

export type IsleDef = {
  id: string;
  name: string;
  x: number; // map coords, 1000 x 600
  y: number;
  size: number; // drawn width
  resource: Resource;
  lanterns: number;
  startLit: number;
  blurb: string;
};

/** The fixed map of Halcyra. */
export const ISLES: IsleDef[] = [
  { id: "hearthstead", name: "Hearthstead", x: 470, y: 330, size: 230, resource: "driftwood", lanterns: 8, startLit: 4, blurb: "The village isle where every keeper first wakes." },
  { id: "mossgrove", name: "Mossgrove", x: 175, y: 210, size: 180, resource: "moonmoss", lanterns: 6, startLit: 2, blurb: "Soft hills of moonmoss that glow when touched." },
  { id: "starfall", name: "Starfall Reach", x: 790, y: 165, size: 170, resource: "starglass", lanterns: 6, startLit: 1, blurb: "Fallen stars cool into glass along its cliffs." },
  { id: "tidewell", name: "Tidewell", x: 160, y: 460, size: 170, resource: "dewpearl", lanterns: 6, startLit: 2, blurb: "A dripping isle where the Cloudsea leaves pearls of dew." },
  { id: "orchard", name: "Lantern Orchard", x: 800, y: 455, size: 180, resource: "glowfruit", lanterns: 6, startLit: 1, blurb: "Trees whose fruit holds a little warm light." },
  { id: "quiet", name: "The Quiet Isle", x: 480, y: 110, size: 150, resource: "starglass", lanterns: 7, startLit: 0, blurb: "Where the Hush began. Nobody has relit it yet." },
];

export const ISLE_BY_ID: Record<string, IsleDef> = Object.fromEntries(ISLES.map((i) => [i.id, i]));
export const START_ISLE = "hearthstead";
export const TOTAL_LANTERNS = ISLES.reduce((s, i) => s + i.lanterns, 0);
