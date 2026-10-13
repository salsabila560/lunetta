import type { Traits } from "@/lib/art/render";

const OPTIONS: { [K in keyof Traits]: string[] } = {
  Background: ["Midnight", "Dusk", "Tide", "Plum"],
  Isle: ["Bare Isle", "Grove", "Lantern Reach", "Cloud Bank"],
  Fur: ["Parchment", "Snow", "Ash", "Lavender", "Ember", "Moss", "Petal"],
  Wings: ["Gold Feather", "Paper Feather", "Moss Feather", "Petal Feather", "Leaf", "Bat"],
  Scarf: ["Ember", "Tide", "Lantern", "Moss", "Petal", "Plum"],
  Accessory: ["None", "None", "Bell", "Sprout", "Flower Crown", "Witch Hat"],
  Eyes: ["Open", "Sleepy", "Wink"],
  Mark: ["Crescent", "Star", "None"],
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A stable look for agents that join without a Lunetta NFT. */
export function guestTraits(seed: string): Traits {
  let h = hash(seed);
  const pick = (arr: string[]) => {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    return arr[h % arr.length];
  };
  return Object.fromEntries(Object.entries(OPTIONS).map(([k, v]) => [k, pick(v)])) as Traits;
}
