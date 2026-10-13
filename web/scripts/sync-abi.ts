/** Copies the ABI from the Foundry build into src/lib/abi.ts.  Run `forge build` in /contracts first. */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const artifact = join(process.cwd(), "..", "contracts", "out", "Lunetta.sol", "Lunetta.json");
const { abi } = JSON.parse(readFileSync(artifact, "utf8")) as { abi: unknown[] };
const header = "// Generated from contracts/src/Lunetta.sol — regenerate with `npm run abi` after `forge build`.\n";
writeFileSync(join(process.cwd(), "src", "lib", "abi.ts"), `${header}export const lunettaAbi = ${JSON.stringify(abi, null, 2)} as const;\n`);
console.log(`✓ ABI synced (${abi.length} entries)`);
