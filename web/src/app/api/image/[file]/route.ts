import { renderHidden, renderToken } from "@/lib/art/render";
import { getToken, mintedCount, parseId } from "@/lib/server/collection";

export const runtime = "nodejs";

function svg(body: string, cache: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": cache,
      "Access-Control-Allow-Origin": "*",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}

/** Token artwork as SVG. Unminted ids return the sleeping placeholder. */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (file === "hidden" || file === "hidden.svg") return svg(renderHidden(), "public, max-age=86400");

  const id = parseId(file);
  const token = getToken(id);
  if (!token) return new Response("Unknown token", { status: 404 });

  if (id > (await mintedCount())) return svg(renderHidden(), "public, max-age=30");
  return svg(renderToken(token.traits, token.seed), "public, max-age=86400, s-maxage=31536000, immutable");
}
