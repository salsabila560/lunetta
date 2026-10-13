/**
 * Builds ERC-721 metadata JSON files from a traits CSV.
 *
 *   IMAGES_CID=bafy... npm run metadata
 *
 * Input:  data/traits.csv  — header: tokenId,Fur,Wings,Scarf,Accessory,Rarity (any trait columns)
 *         images uploaded to IPFS as <tokenId>.png inside one folder (IMAGES_CID)
 * Output: metadata/<tokenId>.json  → upload the folder to IPFS, then reveal("ipfs://<METADATA_CID>/")
 *         metadata/hidden.json      → upload separately; use as UNREVEALED_URI at deploy
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const imagesCid = process.env.IMAGES_CID;
const hiddenImage = process.env.HIDDEN_IMAGE_URI ?? "ipfs://REPLACE_WITH_HIDDEN_IMAGE_CID/hidden.png";
const description =
  process.env.COLLECTION_DESCRIPTION ??
  "A Lunetta moon-cat, lantern keeper of the floating isles of Halcyra. Playable in the Lunetta game.";

function parseCsv(text: string) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const cols = header!.split(",").map((c) => c.trim());
  return lines.filter(Boolean).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ""]));
  });
}

function main() {
  if (!imagesCid) throw new Error("Set IMAGES_CID to the IPFS folder CID that holds <tokenId>.png");
  const rows = parseCsv(readFileSync(join(process.cwd(), "data", "traits.csv"), "utf8"));
  const out = join(process.cwd(), "metadata");
  mkdirSync(out, { recursive: true });

  const seen = new Set<string>();
  for (const row of rows) {
    const id = row.tokenId;
    if (!id || !/^\d+$/.test(id)) throw new Error(`Bad tokenId in row: ${JSON.stringify(row)}`);
    if (seen.has(id)) throw new Error(`Duplicate tokenId ${id}`);
    seen.add(id);

    const attributes = Object.entries(row)
      .filter(([k, v]) => k !== "tokenId" && v !== "")
      .map(([trait_type, value]) => ({ trait_type, value }));

    const meta = {
      name: `Lunetta #${id}`,
      description,
      image: `ipfs://${imagesCid}/${id}.png`,
      attributes,
    };
    writeFileSync(join(out, `${id}.json`), JSON.stringify(meta, null, 2));
  }

  writeFileSync(
    join(out, "hidden.json"),
    JSON.stringify({ name: "Unrevealed Lunetta", description: "This keeper is still asleep. Reveal soon.", image: hiddenImage }, null, 2),
  );

  console.log(`✓ Wrote ${rows.length} metadata files + hidden.json to ./metadata`);
}

main();
