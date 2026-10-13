import "server-only";
import { NextResponse } from "next/server";
import { ActionError } from "./logic";
import { AuthError } from "./service";

export function apiKeyFrom(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const x = req.headers.get("x-api-key");
  if (x) return x.trim();
  const q = new URL(req.url).searchParams.get("key");
  return q ? q.trim() : null;
}

export function originOf(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-api-key, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { ...CORS, "Cache-Control": "no-store" } });
}

export function options() {
  return new Response(null, { status: 204, headers: CORS });
}

export function errorResponse(err: unknown) {
  if (err instanceof AuthError) return json({ ok: false, error: err.message }, 401);
  if (err instanceof ActionError) return json({ ok: false, error: err.message }, 400);
  console.error("[world]", err);
  return json({ ok: false, error: err instanceof Error ? err.message : "Something went wrong." }, 500);
}
