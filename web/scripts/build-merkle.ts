/**
 * Snapshot the whitelist and build the Merkle tree.
 *
 *   npm run merkle                 # DB entries + data/whitelist-extra.csv (optional)
 *   npm run merkle -- --no-db      # only the CSV (e.g. for testnet)
 *
 * Outputs:
 *   data/whitelist-tree.json  → bundled with the site; /api/proof serves proofs from it
 *   data/whitelist-root.txt   → pass this to setMerkleRoot on the contract
 *   data/whitelist-snapshot.csv
 *
 * Re-deploy the site after running this, THEN call setMerkleRoot — in that order,
 * so proofs served by the site always match the root on-chain.
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import postgres from "postgres";
import { getAddress, isAddress } from "viem";

const DATA = join(process.cwd(), "data");

async function fromDb(): Promise<string[]> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Use --no-db to build from CSV only.");
  const sql = postgres(url, { max: 1, prepare: false });
  const rows = await sql<{ address: string }[]>`select address from whitelist_entries order by created_at asc`;
  await sql.end();
  return rows.map((r) => r.address);
}

function fromCsv(): string[] {
  const file = join(DATA, "whitelist-extra.csv");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((l) => l.split(",")[0]!.trim())
    .filter((l) => l && !/^address$/i.test(l));
}

async function main() {
  const useDb = !process.argv.includes("--no-db");
  const raw = [...(useDb ? await fromDb() : []), ...fromCsv()];

  const invalid = raw.filter((a) => !isAddress(a));
  if (invalid.length) {
    console.warn(`⚠ Skipping ${invalid.length} invalid address(es):`, invalid.slice(0, 5));
  }
  const unique = [...new Set(raw.filter((a) => isAddress(a)).map((a) => getAddress(a)))];
  if (unique.length === 0) throw new Error("No addresses found — nothing to build.");

  const tree = StandardMerkleTree.of(unique.map((a) => [a]), ["address"]);

  writeFileSync(join(DATA, "whitelist-tree.json"), JSON.stringify(tree.dump(), null, 2));
  writeFileSync(join(DATA, "whitelist-root.txt"), `${tree.root}\n`);
  writeFileSync(join(DATA, "whitelist-snapshot.csv"), ["address", ...unique].join("\n") + "\n");

  // Self-check: every proof verifies against the root
  for (const [i, v] of tree.entries()) {
    if (!StandardMerkleTree.verify(tree.root, ["address"], v, tree.getProof(i))) {
      throw new Error(`Proof self-check failed for ${v[0]}`);
    }
  }

  console.log(`✓ ${unique.length} addresses`);
  console.log(`✓ Merkle root: ${tree.root}`);
  console.log("Next: commit data/whitelist-tree.json, redeploy the site, then call setMerkleRoot(root).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
