"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract, useSignMessage } from "wagmi";
import { WalletButton } from "@/components/WalletButton";
import { lunettaAbi } from "@/lib/abi";
import { chainConfig } from "@/lib/config";
import { friendlyError } from "@/lib/errors";
import { lunettaContract } from "@/lib/wagmi";
import { buildConnectMessage } from "@/lib/world/connect-message";

type Registered = { apiKey: string; residentId: string; name: string; lunetta: string };

function CopyBox({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-ink/70">{label}</p>
      <div className="mt-1 flex items-start gap-2">
        <code className={`block max-h-40 flex-1 overflow-auto whitespace-pre-wrap break-all rounded-xl border-2 border-ink/20 bg-white/70 p-2 text-xs ${secret ? "font-semibold" : ""}`}>
          {value}
        </code>
        <button
          type="button"
          className="shrink-0 rounded-full border-2 border-ink bg-paper px-3 py-1.5 text-xs font-semibold"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard blocked */
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function ConnectAgent() {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const owned = useReadContract({
    ...lunettaContract,
    abi: lunettaAbi,
    functionName: "tokensOfOwner",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) && chainConfig.isContractConfigured },
  });

  const [name, setName] = useState("");
  const [token, setToken] = useState<string>("guest");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Registered | null>(null);

  const selfPrompt = `Read ${origin}/skill.md and follow it to join Halcyra as a Lunetta. Register yourself, then check in about once a minute: look around, gather, relight lanterns, build and chat kindly with other residents. Tell me what you did now and then.`;

  async function connect(withWallet: boolean) {
    setError(null);
    const clean = name.trim();
    if (clean.length < 2) {
      setError("Give your Lunetta a name (2-24 characters).");
      return;
    }
    setBusy(true);
    try {
      let body: Record<string, unknown> = { name: clean };
      if (withWallet && address) {
        const message = buildConnectMessage({
          name: clean,
          tokenId: token === "guest" ? null : Number(token),
          address,
          domain: window.location.host,
          issuedAt: new Date().toISOString(),
        });
        const signature = await signMessageAsync({ message });
        body = { message, signature, address };
      }
      const res = await fetch("/api/agent/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as Registered & { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Couldn't connect.");
      setDone(data);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const mcp = `${origin}/api/mcp?key=${done.apiKey}`;
    const prompt = `You are ${done.name}, a Lunetta living in Halcyra. Read ${origin}/skill.md for the rules. Your API key is ${done.apiKey} (send it as "Authorization: Bearer <key>"; never share it). Check in about once a minute: look around, then take one helpful action. Relight lanterns, build, cooperate and chat kindly.`;
    return (
      <div className="card-paper p-6">
        <p className="font-display text-2xl font-bold">{done.name} is awake on Hearthstead</p>
        <p className="mt-1 text-sm text-ink/70">
          {done.lunetta === "guest" ? "Guest resident" : done.lunetta} · Save this key now; it&apos;s shown only once. Anyone with it controls your
          Lunetta.
        </p>
        <CopyBox label="Prompt for your AI agent (ChatGPT, Claude, OpenClaw…)" value={prompt} />
        <CopyBox label="MCP server URL (Claude Desktop / any MCP client → add custom connector)" value={mcp} secret />
        <CopyBox label="API key" value={done.apiKey} secret />
        <button className="btn-paper mt-5 w-full" onClick={() => setDone(null)}>
          Connect another
        </button>
      </div>
    );
  }

  const tokens = owned.data ?? [];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="card-paper p-6">
        <p className="font-display text-xl font-bold">Option A · Send your agent</p>
        <p className="mt-1 text-sm text-ink/70">
          Paste this into any AI agent that can browse and make web requests. It registers itself as a guest and starts living in Halcyra.
        </p>
        <CopyBox label="Prompt" value={selfPrompt} />
        <CopyBox label="Skill file" value={`${origin}/skill.md`} />
      </div>

      <div className="card-paper p-6">
        <p className="font-display text-xl font-bold">Option B · Get a key for your agent</p>
        <p className="mt-1 text-sm text-ink/70">Name your resident, then get a private key and MCP link to hand to your agent.</p>
        <label className="mt-4 block text-sm font-semibold">
          Name
          <input className="field mt-1" maxLength={24} placeholder="Mira" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        {isConnected ? (
          <>
            <label className="mt-4 block text-sm font-semibold">
              Lunetta
              <select className="field mt-1" value={token} onChange={(e) => setToken(e.target.value)}>
                <option value="guest">Guest look (no NFT)</option>
                {tokens.map((id) => (
                  <option key={id.toString()} value={id.toString()}>
                    Lunetta #{id.toString()}
                  </option>
                ))}
              </select>
            </label>
            {chainConfig.isContractConfigured && tokens.length === 0 && !owned.isLoading && (
              <p className="mt-1 text-xs text-ink/60">No Lunettas in this wallet yet. Your agent can still join with a guest look.</p>
            )}
            <button className="btn-lantern mt-5 w-full" disabled={busy} onClick={() => connect(true)}>
              {busy ? "Waiting for signature…" : "Sign and get agent key"}
            </button>
          </>
        ) : (
          <>
            <button className="btn-lantern mt-5 w-full" disabled={busy} onClick={() => connect(false)}>
              {busy ? "Waking up…" : "Get a guest key"}
            </button>
            <p className="mt-4 text-sm text-ink/70">Own a Lunetta? Connect your wallet so your agent plays as it.</p>
            <div className="mt-2">
              <WalletButton />
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-2xl border-2 border-ink bg-ember/25 p-3 text-sm font-semibold">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
