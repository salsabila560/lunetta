import { NextResponse } from "next/server";
import { baseUrl, getToken, hiddenMetadata, metadataFor, mintedCount, parseId } from "@/lib/server/collection";

export const runtime = "nodejs";

/**
 * Token metadata. The contract's baseURI points here (…/api/metadata/), and it
 * appends "<id>.json". Unminted ids get the sleeping placeholder.
 */
export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const origin = baseUrl(req);

  if (file === "hidden" || file === "hidden.json") {
    return NextResponse.json(hiddenMetadata(origin), { headers: { "Cache-Control": "public, max-age=3600" } });
  }

  const id = parseId(file);
  const token = getToken(id);
  if (!token) return NextResponse.json({ error: "Unknown token" }, { status: 404 });

  const minted = await mintedCount();
  if (id > minted) {
    return NextResponse.json(hiddenMetadata(origin, id), { headers: { "Cache-Control": "public, max-age=30" } });
  }
  return NextResponse.json(metadataFor(token, origin), {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400", "Access-Control-Allow-Origin": "*" },
  });
}
