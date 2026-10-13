import type { Traits } from "@/lib/art/render";

/** Gameplay stats derived from a Lunetta's traits. */
export type Stats = {
  maxJumps: number; // jumps before touching an isle again
  glideFall: number; // max fall speed while holding (lower = floatier)
  lives: number;
  skillCooldown: number; // seconds for Warm Light
  skillRadius: number;
  magnet: number; // lantern / star pickup radius
  scoreMult: number;
  lanternBonus: number;
  hushSpeed: number; // multiplier on Hush speed
  foresight: boolean; // warns before Hush arrives
};

export type StatLine = { trait: string; value: string; effect: string };

const WINGS: Record<string, { jumps: number; glide: number; label: string }> = {
  "Gold Feather": { jumps: 2, glide: 170, label: "Double jump, steady glide" },
  "Paper Feather": { jumps: 2, glide: 190, label: "Double jump" },
  "Moss Feather": { jumps: 2, glide: 160, label: "Double jump, soft glide" },
  "Petal Feather": { jumps: 2, glide: 160, label: "Double jump, soft glide" },
  Leaf: { jumps: 2, glide: 110, label: "Double jump, longest glide" },
  Bat: { jumps: 3, glide: 240, label: "Triple jump, short glide" },
  Starlight: { jumps: 3, glide: 130, label: "Triple jump, long glide" },
};

export function statsFor(t: Traits): { stats: Stats; lines: StatLine[] } {
  const w = WINGS[t.Wings] ?? WINGS["Gold Feather"];
  const stats: Stats = {
    maxJumps: w.jumps,
    glideFall: w.glide,
    lives: t.Fur === "Moongold" ? 5 : t.Fur === "Snow" || t.Fur === "Midnight" ? 4 : 3,
    skillCooldown: t.Scarf === "None" ? 14 : t.Scarf === "Lantern" ? 7 : 9,
    skillRadius: t.Accessory === "Witch Hat" ? 175 : 125,
    magnet: t.Accessory === "Bell" ? 70 : 28,
    scoreMult: t.Accessory === "Star Crown" ? 2 : 1,
    lanternBonus: t.Mark === "Star" ? 5 : 0,
    hushSpeed: t.Accessory === "Flower Crown" ? 0.75 : 1,
    foresight: t.Eyes === "Starry" || t.Eyes === "Heterochromia",
  };
  if (t.Accessory === "Sprout") stats.lives += 1;
  if (t.Mark === "Full Moon") stats.skillCooldown -= 2;

  const lines: StatLine[] = [
    { trait: "Wings", value: t.Wings, effect: w.label },
    { trait: "Fur", value: t.Fur, effect: `${stats.lives} lives` },
    { trait: "Scarf", value: t.Scarf, effect: `Warm Light every ${stats.skillCooldown}s` },
  ];
  const acc: Record<string, string> = {
    Bell: "Pulls lanterns and stars toward you",
    "Witch Hat": "Bigger Warm Light",
    "Star Crown": "Double score",
    "Flower Crown": "The Hush moves slower",
    Sprout: "+1 life",
  };
  if (acc[t.Accessory]) lines.push({ trait: "Accessory", value: t.Accessory, effect: acc[t.Accessory] });
  if (stats.foresight) lines.push({ trait: "Eyes", value: t.Eyes, effect: "Sees the Hush coming" });
  if (t.Mark === "Star") lines.push({ trait: "Mark", value: t.Mark, effect: "+5 per lantern" });
  if (t.Mark === "Full Moon") lines.push({ trait: "Mark", value: t.Mark, effect: "Faster Warm Light" });
  return { stats, lines };
}

/** The character everyone can play before owning a Lunetta. */
export const GUEST_TRAITS: Traits = {
  Background: "Midnight",
  Isle: "Bare Isle",
  Fur: "Parchment",
  Wings: "Gold Feather",
  Scarf: "Ember",
  Accessory: "None",
  Eyes: "Open",
  Mark: "Crescent",
};
