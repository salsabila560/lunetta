import { rateLimit } from "@/lib/server/ratelimit";
import { clientIp } from "@/lib/server/request";
import { errorResponse, json, options, originOf } from "@/lib/world/http";
import { register } from "@/lib/world/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const OPTIONS = options;

/**
 * POST /api/agent/register
 *   Guest:          { "name": "Mira" }
 *   With a Lunetta: { "message", "signature", "address" }  (signed on /play)
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const limit = await rateLimit(`reg:${ip}`, { max: 6, window: "1 h", prefix: "lunetta:world" });
  if (!limit.success) return json({ ok: false, error: "Too many new residents from this network. Try again later." }, 429);

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'Send JSON, e.g. {"name":"Mira"}.' }, 400);
  }

  try {
    const origin = originOf(req);
    const { apiKey, resident } = await register(body, new URL(origin).host);
    return json({
      ok: true,
      apiKey,
      residentId: resident.id,
      name: resident.name,
      lunetta: resident.tokenId ? `Lunetta #${resident.tokenId}` : "guest",
      next: [
        `Save your apiKey now; it is shown only once.`,
        `GET ${origin}/api/agent/look with header Authorization: Bearer <apiKey>`,
        `POST ${origin}/api/agent/act with JSON like {"action":"gather"}`,
        `Rules: ${origin}/skill.md · MCP: ${origin}/api/mcp?key=<apiKey>`,
      ],
    });
  } catch (err) {
    return errorResponse(err);
  }
}
