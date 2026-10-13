import "server-only";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { getAddress, type Address, type Hex } from "viem";
import treeDump from "../../../data/whitelist-tree.json";

type Dump = Parameters<typeof StandardMerkleTree.load<[string]>>[0];

let tree: StandardMerkleTree<[string]> | null = null;
let index: Map<string, number> | null = null;

function load() {
  if (tree && index) return { tree, index };
  const dump = treeDump as unknown as Dump & { values: unknown[] };
  if (!dump.values || dump.values.length === 0) return null;
  tree = StandardMerkleTree.load<[string]>(dump);
  index = new Map();
  for (const [i, [addr]] of tree.entries()) index.set(addr.toLowerCase(), i);
  return { tree, index };
}

export function merkleRoot(): Hex | null {
  return (load()?.tree.root as Hex | undefined) ?? null;
}

export function proofFor(address: Address): { eligible: boolean; proof: Hex[] } {
  const loaded = load();
  if (!loaded) return { eligible: false, proof: [] };
  const i = loaded.index.get(getAddress(address).toLowerCase());
  if (i === undefined) return { eligible: false, proof: [] };
  return { eligible: true, proof: loaded.tree.getProof(i) as Hex[] };
}
