import { chainConfig } from "@/lib/config";
import { clientIp } from "@/lib/server/request";
import { rateLimit } from "@/lib/server/ratelimit";

/**
 * Read-only JSON-RPC proxy for the browser.
 *
 * Some visitors' networks can't reach the chain's public RPC directly (requests hang), so the
 * site reads chain data through this route instead. Only read methods are forwarded; wallets
 * still sign and send transactions through their own RPC.
 */
export const dynamic = "force-dynamic";

const UPSTREAM = process.env.RPC_UPSTREAM_URL || chainConfig.rpcUrl;

const ALLOWED = new Set([
  "eth_chainId",
  "net_version",
  "eth_blockNumber",
  "eth_call",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
  "eth_getBalance",
  "eth_getCode",
  "eth_getTransactionCount",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "eth_getLogs",
]);

type RpcRequest = { jsonrpc?: string; id?: unknown; method?: unknown; params?: unknown };

function rpcError(id: unknown, message: string, code = -32601) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = await rateLimit(`rpc:${ip}`, { max: 600, window: "1 m", prefix: "lunetta:rpc" });
  if (!rl.success) return Response.json(rpcError(null, "Too many requests, slow down.", -32005), { status: 429 });

  let body: RpcRequest | RpcRequest[];
  try {
    body = (await req.json()) as RpcRequest | RpcRequest[];
  } catch {
    return Response.json(rpcError(null, "Invalid JSON", -32700), { status: 400 });
  }

  const batch = Array.isArray(body) ? body : [body];
  if (batch.length === 0 || batch.length > 50) return Response.json(rpcError(null, "Invalid batch size", -32600), { status: 400 });

  const blocked = batch.filter((r) => typeof r.method !== "string" || !ALLOWED.has(r.method));
  if (blocked.length > 0) {
    const errors = blocked.map((r) => rpcError(r.id, `Method not allowed: ${String(r.method)}`));
    return Response.json(Array.isArray(body) ? errors : errors[0], { status: 400 });
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch {
    return Response.json(rpcError(null, "Upstream RPC unavailable", -32603), { status: 502 });
  }
}
