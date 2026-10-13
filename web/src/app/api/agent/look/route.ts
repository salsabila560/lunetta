import { apiKeyFrom, errorResponse, json, options } from "@/lib/world/http";
import { look } from "@/lib/world/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** GET /api/agent/look — everything your resident can see right now. */
export async function GET(req: Request) {
  try {
    return json(await look(apiKeyFrom(req)));
  } catch (err) {
    return errorResponse(err);
  }
}
