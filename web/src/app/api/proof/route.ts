import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { merkleRoot, proofFor } from "@/lib/server/merkle";

export const runtime = "nodejs";

/** GET /api/proof?address=0x… → Merkle proof for the whitelist mint. */
export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address");
  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }
  const { eligible, proof } = proofFor(address);
  return NextResponse.json(
    { eligible, proof, root: merkleRoot() },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}
