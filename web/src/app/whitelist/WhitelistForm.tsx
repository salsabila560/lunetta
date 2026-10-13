"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { WalletButton } from "@/components/WalletButton";
import { chainConfig, siteConfig } from "@/lib/config";
import { friendlyError } from "@/lib/errors";
import { buildWhitelistMessage } from "@/lib/whitelist-message";

type Status = {
  open: boolean;
  closesAt: string | null;
  maxSpots: number;
  full: boolean;
  count: number;
  registered: boolean;
  error?: string;
};

export function WhitelistForm() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const queryClient = useQueryClient();
  const [xHandle, setXHandle] = useState("");
  const [handleError, setHandleError] = useState<string | null>(null);

  const status = useQuery<Status>({
    queryKey: ["whitelist-status", address],
    queryFn: async () => {
      const res = await fetch(`/api/whitelist${address ? `?address=${address}` : ""}`, { cache: "no-store" });
      const data = (await res.json()) as Status;
      if (!res.ok) throw new Error(data.error ?? "Couldn't load whitelist status.");
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error("Connect a wallet first.");
      const message = buildWhitelistMessage({
        address,
        chainId: chainConfig.chainId,
        domain: new URL(siteConfig.url).host,
        issuedAt: new Date().toISOString(),
      });
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, message, signature, xHandle }),
      });
      const data = (await res.json()) as { ok?: boolean; alreadyRegistered?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn't save your spot.");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whitelist-status"] }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = xHandle.trim().replace(/^@/, "");
    if (clean && !/^[A-Za-z0-9_]{1,15}$/.test(clean)) {
      setHandleError("Use letters, numbers and _ only (max 15).");
      return;
    }
    setHandleError(null);
    submit.mutate();
  }

  const s = status.data;

  return (
    <div className="card-paper p-6 sm:p-8">
      {/* status pill */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Join the whitelist</h2>
        {status.isLoading ? (
          <span className="h-8 w-24 animate-pulse rounded-full bg-parchment" aria-label="Loading status" />
        ) : s ? (
          <span
            className={`inline-flex items-center gap-2 rounded-full border-2 border-ink px-3 py-1 text-sm font-semibold ${s.open ? "bg-moss" : "bg-parchment"}`}
          >
            <span className={`h-2 w-2 rounded-full ${s.open ? "bg-ink" : "bg-ink/40"}`} aria-hidden="true" />
            {s.open ? "Open" : "Closed"}
          </span>
        ) : null}
      </div>

      {s && (
        <p className="mt-2 text-sm text-ink/70">
          {s.count.toLocaleString()} {s.count === 1 ? "keeper" : "keepers"} registered
          {s.maxSpots > 0 ? ` of ${s.maxSpots.toLocaleString()} spots` : ""}
          {s.open && s.closesAt ? ` · closes ${new Date(s.closesAt).toLocaleString()}` : ""}
        </p>
      )}

      <div className="mt-6" aria-live="polite">
        {status.isError ? (
          <div className="rounded-2xl border-2 border-ink bg-ember/20 p-4">
            <p className="font-semibold">{(status.error as Error).message}</p>
            <button className="mt-3 font-semibold underline" onClick={() => status.refetch()}>
              Retry
            </button>
          </div>
        ) : s?.registered ? (
          <div className="rounded-2xl border-2 border-ink bg-moss/40 p-5">
            <p className="font-display text-xl font-bold">You&apos;re on the list.</p>
            <p className="mt-1 text-ink/80">This wallet has a spot. Come back when the whitelist mint opens.</p>
          </div>
        ) : s && !s.open ? (
          <div className="rounded-2xl border-2 border-ink bg-parchment p-5">
            <p className="font-display text-xl font-bold">{s.full ? "All spots are taken." : "The whitelist is closed."}</p>
            <p className="mt-1 text-ink/80">Follow our socials for the public mint date.</p>
          </div>
        ) : !isConnected ? (
          <div>
            <p className="mb-4 text-ink/80">Connect the wallet you&apos;ll mint with.</p>
            <WalletButton size="lg" />
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <label htmlFor="wallet" className="text-sm font-semibold">Wallet</label>
            <input id="wallet" className="field mt-1 font-mono text-sm" value={address ?? ""} readOnly />

            <label htmlFor="x-handle" className="mt-5 block text-sm font-semibold">
              X handle <span className="font-normal text-ink/60">(optional)</span>
            </label>
            <input
              id="x-handle"
              className="field mt-1"
              placeholder="@moonkeeper"
              value={xHandle}
              maxLength={16}
              autoComplete="off"
              aria-invalid={Boolean(handleError)}
              aria-describedby={handleError ? "x-handle-error" : undefined}
              onChange={(e) => {
                setXHandle(e.target.value);
                setHandleError(null);
              }}
            />
            {handleError && (
              <p id="x-handle-error" className="mt-1 text-sm font-semibold text-ember">{handleError}</p>
            )}

            <button type="submit" className="btn-lantern mt-6 w-full" disabled={submit.isPending}>
              {submit.isPending ? "Waiting for signature…" : "Sign and join"}
            </button>

            {submit.isError && (
              <p className="mt-4 rounded-2xl border-2 border-ink bg-ember/20 p-3 text-sm font-semibold" role="alert">
                {friendlyError(submit.error)}
              </p>
            )}
            {submit.isSuccess && (
              <p className="mt-4 rounded-2xl border-2 border-ink bg-moss/40 p-3 text-sm font-semibold">
                {submit.data.alreadyRegistered ? "This wallet was already registered." : "You're in! See you at the mint."}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
