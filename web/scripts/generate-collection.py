"""Generates the 1,000-piece Lunetta collection (traits only — art is rendered from traits).

    python3 web/scripts/generate-collection.py

Writes web/data/collection.json. Deterministic: the same SEED always yields the
same collection, so regenerating never silently changes minted tokens.
"""
import hashlib
import json
import math
import random
from pathlib import Path

SEED = "lunetta-halcyra-2026"
SUPPLY = 1000
MOONBORN = 5  # hand-picked 1/1s

TRAITS = {
    "Background": {"Midnight": 30, "Dusk": 24, "Tide": 18, "Plum": 12, "Parchment": 10, "Dawn": 6},
    "Isle": {"Bare Isle": 32, "Grove": 28, "Lantern Reach": 24, "Cloud Bank": 16},
    "Fur": {"Parchment": 20, "Snow": 16, "Ash": 16, "Lavender": 14, "Ember": 12, "Moss": 10, "Petal": 8, "Midnight": 4},
    "Wings": {"Gold Feather": 24, "Paper Feather": 20, "Moss Feather": 16, "Petal Feather": 12, "Leaf": 12, "Bat": 10, "Starlight": 6},
    "Scarf": {"Ember": 22, "Tide": 18, "Lantern": 16, "Moss": 14, "Petal": 12, "Plum": 10, "None": 8},
    "Accessory": {"None": 38, "Bell": 18, "Sprout": 14, "Flower Crown": 12, "Witch Hat": 12, "Star Crown": 6},
    "Eyes": {"Open": 40, "Sleepy": 22, "Wink": 16, "Starry": 12, "Heterochromia": 10},
    "Mark": {"Crescent": 50, "Star": 25, "Full Moon": 15, "None": 10},
}
ORDER = list(TRAITS.keys())

MOONBORN_SET = [
    {"Background": "Midnight", "Isle": "Lantern Reach", "Name": "Selene"},
    {"Background": "Plum", "Isle": "Grove", "Name": "Noctis"},
    {"Background": "Tide", "Isle": "Cloud Bank", "Name": "Halcy"},
    {"Background": "Dusk", "Isle": "Bare Isle", "Name": "Vesper"},
    {"Background": "Midnight", "Isle": "Cloud Bank", "Name": "Lumen"},
]


def pick(rng, table):
    total = sum(table.values())
    r = rng.uniform(0, total)
    for k, w in table.items():
        r -= w
        if r <= 0:
            return k
    return list(table)[-1]


def roll(rng):
    while True:
        t = {k: pick(rng, v) for k, v in TRAITS.items()}
        if t["Accessory"] == "Bell" and t["Scarf"] == "None":
            continue  # the bell hangs from the scarf
        return t


def main():
    rng = random.Random(SEED)
    seen = set()
    items = []
    while len(items) < SUPPLY - MOONBORN:
        t = roll(rng)
        key = tuple(t[k] for k in ORDER)
        if key in seen:
            continue
        seen.add(key)
        items.append(t)

    for m in MOONBORN_SET:
        items.append({
            "Background": m["Background"], "Isle": m["Isle"], "Fur": "Moongold", "Wings": "Starlight",
            "Scarf": "None", "Accessory": "Star Crown", "Eyes": "Starry", "Mark": "Full Moon",
            "_name": m["Name"],
        })

    rng.shuffle(items)

    # Rarity score = sum of -ln(p) across traits; Moonborn always top.
    def prob(trait, value):
        table = TRAITS[trait]
        return table.get(value, 0.5) / sum(table.values())

    scores = []
    for t in items:
        if "_name" in t:
            scores.append(math.inf)
        else:
            scores.append(sum(-math.log(prob(k, t[k])) for k in ORDER))
    ranked = sorted(range(len(items)), key=lambda i: -scores[i])
    rank_of = {idx: r + 1 for r, idx in enumerate(ranked)}

    out = []
    for i, t in enumerate(items):
        rank = rank_of[i]
        if "_name" in t:
            tier = "Moonborn"
        elif rank <= 25:
            tier = "Legendary"
        elif rank <= 125:
            tier = "Rare"
        elif rank <= 425:
            tier = "Uncommon"
        else:
            tier = "Common"
        token_id = i + 1
        seed = int(hashlib.sha256(f"{SEED}:{token_id}".encode()).hexdigest()[:8], 16)
        entry = {
            "id": token_id,
            "name": f"Lunetta #{token_id}" if "_name" not in t else f"Lunetta #{token_id} — {t['_name']} the Moonborn",
            "seed": seed,
            "rank": rank,
            "traits": {k: t[k] for k in ORDER},
            "tier": tier,
        }
        out.append(entry)

    path = Path(__file__).resolve().parent.parent / "data" / "collection.json"
    path.write_text(json.dumps(out, separators=(",", ":")))
    tiers = {}
    for e in out:
        tiers[e["tier"]] = tiers.get(e["tier"], 0) + 1
    print(f"Wrote {len(out)} tokens to {path}")
    print("Tiers:", tiers)


if __name__ == "__main__":
    main()
