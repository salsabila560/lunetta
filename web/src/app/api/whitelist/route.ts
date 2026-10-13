import { NextResponse } from "next/server";
import { createPublicClient, getAddress, http, isAddress, isHex } from "viem";
import { z } from "zod";
import { chainConfig, siteConfig } from "@/lib/config";
import { countEntries, findEntry, insertEntry } from "@/lib/server/db";
import { rateLimit } from "@/lib/server/ratelimit";
import { clientIp, hashIp, whitelistStatus } from "@/lib/server/request";
import { MESSAGE_MAX_AGE_MS, parseWhitelistMessage } from "@/lib/whitelist-message";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const publicClient = createPublicClient({ chain: chainConfig.chain, transport: http(chainConfig.rpcUrl) });

const bodySchema = z.object({
  address: z.string().refine((v) => isAddress(v), "Invalid wallet address"),
  message: z.string().min(20).max(1000),
  signature: z.string().refine((v) => isHex(v) && v.length >= 132, "Invalid signature"),
  xHandle: z
    .string()
    .trim()
    .transform((v) => v.replace(/^@/, ""))
    .refine((v) => v === "" || /^[A-Za-z0-9_]{1,15}$/.test(v), "X handle can only use letters, numbers and _")
    .optional(),
});

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** GET /api/whitelist?address=0x… → status, and whether that wallet is registered. */
export async function GET(req: Request) {
  if (!process.env.DATABASE_URL) {
    // Not configured yet: report the whitelist as closed instead of erroring.
    return json({ ...whitelistStatus(0), open: false, count: 0, registered: false });
  }
  try {
    const url = new URL(req.url);
    const address = url.searchParams.get("address");
    const count = await countEntries();
    const status = whitelistStatus(count);
    let registered = false;
    if (address && isAddress(address)) registered = Boolean(await findEntry(address));
    return json({ ...status, count, registered });
  } catch (err) {
    console.error("[whitelist:GET]", err);
    return json({ error: "Couldn't load whitelist status. Try again shortly." }, 500);
  }
}

/** POST /api/whitelist — register a wallet after verifying its signature. */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const limit = await rateLimit(`ip:${ip}`);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.reset - Date.now()) / 1000)) } },
    );
  }

  let parsedBody: z.infer<typeof bodySchema>;
  try {
    const result = bodySchema.safeParse(await req.json());
    if (!result.success) return json({ error: result.error.issues[0]?.message ?? "Invalid request" }, 400);
    parsedBody = result.data;
  } catch {
    return json({ error: "Invalid request" }, 400);
  }

  try {
    const count = await countEntries();
    const status = whitelistStatus(count);
    if (!status.open) {
      return json({ error: status.full ? "The whitelist is full." : "The whitelist is closed." }, 403);
    }

    const address = getAddress(parsedBody.address);
    const msg = parseWhitelistMessage(parsedBody.message);
    if (!msg) return json({ error: "Unrecognised message. Refresh the page and sign again." }, 400);

    const expectedDomain = new URL(siteConfig.url).host;
    const issuedAt = Date.parse(msg.issuedAt);
    const age = Date.now() - issuedAt;
    if (
      msg.domain !== expectedDomain ||
      msg.chainId !== chainConfig.chainId ||
      getAddress(msg.wallet) !== address ||
      Number.isNaN(issuedAt) ||
      age > MESSAGE_MAX_AGE_MS ||
      age < -2 * 60 * 1000
    ) {
      return json({ error: "Your signature expired or doesn't match. Sign again." }, 400);
    }

    // Supports EOAs and smart-contract wallets (ERC-1271 / ERC-6492).
    const valid = await publicClient.verifyMessage({
      address,
      message: parsedBody.message,
      signature: parsedBody.signature as `0x${string}`,
    });
    if (!valid) return json({ error: "Signature verification failed." }, 401);

    const inserted = await insertEntry({
      address,
      xHandle: parsedBody.xHandle || null,
      message: parsedBody.message,
      signature: parsedBody.signature,
      ipHash: hashIp(ip),
    });

    return json({ ok: true, alreadyRegistered: !inserted }, inserted ? 201 : 200);
  } catch (err) {
    console.error("[whitelist:POST]", err);
    return json({ error: "Couldn't save your spot. Try again shortly." }, 500);
  }
}
