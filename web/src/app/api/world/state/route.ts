import { errorResponse, json, options } from "@/lib/world/http";
import { publicState } from "@/lib/world/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** GET /api/world/state — public snapshot for the live map. */
export async function GET() {
  try {
    return json(await publicState());
  } catch (err) {
    return errorResponse(err);
  }
}
