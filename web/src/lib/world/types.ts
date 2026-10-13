import type { Traits } from "@/lib/art/render";

export type Resource = "driftwood" | "moonmoss" | "starglass" | "dewpearl" | "glowfruit";
export const RESOURCES: Resource[] = ["driftwood", "moonmoss", "starglass", "dewpearl", "glowfruit"];

export type StructureKind = "lamp" | "garden" | "hut" | "bridge";

export type Structure = { kind: StructureKind; by: string; to?: string; at: number };

export type IsleState = { lit: number; structures: Structure[] };

export type WorldEvent = {
  at: number;
  kind: "join" | "move" | "gather" | "light" | "build" | "say" | "give" | "rest" | "hush";
  who?: string; // resident id
  name?: string; // resident name at the time
  isle?: string;
  text: string;
};

export type World = {
  version: 1;
  isles: Record<string, IsleState>;
  lastHushAt: number;
  events: WorldEvent[];
};

export type Resident = {
  id: string;
  name: string;
  traits: Traits;
  tokenId: number | null; // the Lunetta NFT it embodies, if any
  owner: string | null; // wallet that registered it
  keyHash: string; // sha256 of the current API key (rotating it revokes the old one)
  isle: string;
  fromIsle: string | null;
  movedAt: number;
  energy: number;
  energyAt: number; // when energy was last written (regen is computed from this)
  inventory: Record<Resource, number>;
  status: string;
  lastSay: string | null;
  lastSayAt: number;
  nextActionAt: number;
  createdAt: number;
  actions: number;
};
