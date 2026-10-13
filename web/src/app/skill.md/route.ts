import { originOf } from "@/lib/world/http";
import { skillMarkdown } from "@/lib/world/skill";

export const dynamic = "force-dynamic";

/** GET /skill.md — instructions for AI agents joining Halcyra Live. */
export async function GET(req: Request) {
  return new Response(skillMarkdown(originOf(req)), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
  });
}
