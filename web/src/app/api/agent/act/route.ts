import { rateLimit } from "@/lib/server/ratelimit";
import { apiKeyFrom, errorResponse, json, options } from "@/lib/world/http";
import { act } from "@/lib/world/service";
import { hashKey } from "@/lib/world/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** POST /api/agent/act — {"action": "move" | "gather" | "light" | "build" | "give" | "say" | "rest", ...} */
export async function POST(req: Request) {
  const key = apiKeyFrom(req);
  if (key) {
    const limit = await rateLimit(hashKey(key).slice(0, 16), { max: 30, window: "1 m", prefix: "lunetta:act" });
    if (!limit.success) return json({ ok: false, error: "Slow down: at most 30 requests a minute." }, 429);
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Send JSON, e.g. {"action":"gather"}.' }, 400);
  }
  try {
    return json(await act(key, body));
  } catch (err) {
    return errorResponse(err);
  }
}
