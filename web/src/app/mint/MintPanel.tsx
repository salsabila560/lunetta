"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { formatEther, zeroAddress, type Hex } from "viem";
import { useAccount, useBalance, useReadContract, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { WalletButton } from "@/components/WalletButton";
import { lunettaAbi } from "@/lib/abi";
import { chainConfig, explorerTx } from "@/lib/config";
import { friendlyError } from "@/lib/errors";
import { lunettaContract } from "@/lib/wagmi";

const PHASES = ["Closed", "Whitelist", "Public"] as const;

function formatEth(wei: bigint) {
  const n = Number(formatEther(wei));
  return n.toLocaleString(undefined, { maximumFractionDigits: 5 });
}

export function MintPanel() {
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [quantity, setQuantity] = useState(1);
  const [localError, setLocalError] = useState<string | null>(null);

  const state = useReadContract({
    ...lunettaContract,
    abi: lunettaAbi,
    functionName: "mintState",
    args: [address ?? zeroAddress],
    query: { enabled: chainConfig.isContractConfigured, refetchInterval: 6_000 },
  });

  const onchainRoot = useReadContract({
    ...lunettaContract,
    abi: lunettaAbi,
    functionName: "merkleRoot",
    query: { enabled: chainConfig.isContractConfigured },
  });

  const s = state.data;
  const phase = s ? Number(s.phase) : 0;

  const proof = useQuery({
    queryKey: ["proof", address],
    enabled: Boolean(address) && phase === 1,
    queryFn: async () => {
      const res = await fetch(`/api/proof?address=${address}`);
      if (!res.ok) throw new Error("Couldn't check whitelist status.");
      return (await res.json()) as { eligible: boolean; proof: Hex[]; root: Hex | null };
    },
  });

  const balance = useBalance({ address, chainId: chainConfig.chainId, query: { enabled: Boolean(address) } });

  const { writeContractAsync, data: txHash, isPending: confirmingInWallet, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: txHash, chainId: chainConfig.chainId });

  useEffect(() => {
    if (receipt.isSuccess) {
      state.refetch();
      balance.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess]);

  const derived = useMemo(() => {
    if (!s) return null;
    const price = phase === 1 ? s.whitelistPrice : s.publicPrice;
    const limit = phase === 1 ? s.whitelistLimit : s.publicLimit;
    const minted = phase === 1 ? s.whitelistMintedBy : s.publicMintedBy;
    const supplyLeft = s.maxSupply - s.totalMinted;
    const walletLeft = limit > minted ? limit - minted : 0n;
    const maxQty = Number(walletLeft < supplyLeft ? walletLeft : supplyLeft);
    const pct = s.maxSupply > 0n ? Number((s.totalMinted * 10_000n) / s.maxSupply) / 100 : 0;
    return { price, limit, minted, supplyLeft, walletLeft, maxQty, pct, soldOut: supplyLeft === 0n };
  }, [s, phase]);

  useEffect(() => {
    if (derived && derived.maxQty > 0 && quantity > derived.maxQty) setQuantity(derived.maxQty);
  }, [derived, quantity]);

  const total = derived ? derived.price * BigInt(quantity) : 0n;
  const wrongChain = isConnected && walletChainId !== chainConfig.chainId;
  const rootMismatch =
    phase === 1 && proof.data?.root && onchainRoot.data && proof.data.root.toLowerCase() !== onchainRoot.data.toLowerCase();

  async function mint() {
    setLocalError(null);
    reset();
    if (!derived || !address) return;
    if (balance.data && balance.data.value < total) {
      setLocalError("Your wallet doesn't have enough ETH for this mint.");
      return;
    }
    try {
      if (phase === 1) {
        if (!proof.data?.eligible) {
          setLocalError("This wallet isn't on the whitelist.");
          return;
        }
        await writeContractAsync({
          ...lunettaContract,
          abi: lunettaAbi,
          functionName: "whitelistMint",
          args: [BigInt(quantity), proof.data.proof],
          value: total,
        });
      } else {
        await writeContractAsync({
          ...lunettaContract,
          abi: lunettaAbi,
          functionName: "publicMint",
          args: [BigInt(quantity)],
          value: total,
        });
      }
    } catch (err) {
      setLocalError(friendlyError(err));
    }
  }

  // ------------------------------------------------------------------ render

  if (!chainConfig.isContractConfigured) {
    return (
      <Panel>
        <p className="font-display text-2xl font-bold">Mint opens soon</p>
        <p className="mt-2 text-ink/75">The contract hasn&apos;t been announced yet. Join the whitelist to mint first.</p>
        <Link href="/whitelist" className="btn-lantern mt-6 w-full">Join the whitelist</Link>
      </Panel>
    );
  }

  if (state.isError) {
    return (
      <Panel>
        <p className="font-semibold">Couldn&apos;t read the contract. Check your connection and try again.</p>
        <button className="btn-paper mt-4" onClick={() => state.refetch()}>Retry</button>
      </Panel>
    );
  }

  if (!s || !derived) {
    return (
      <Panel>
        <div className="space-y-4" aria-label="Loading mint details">
          <div className="h-6 w-1/2 animate-pulse rounded-full bg-parchment" />
          <div className="h-4 w-full animate-pulse rounded-full bg-parchment" />
          <div className="h-12 w-full animate-pulse rounded-full bg-parchment" />
        </div>
      </Panel>
    );
  }

  const disabledReason = !isConnected
    ? null
    : wrongChain
      ? null
      : phase === 0
        ? "The mint hasn't started yet."
        : derived.soldOut
          ? null
          : phase === 1 && proof.isLoading
            ? "Checking whitelist…"
            : phase === 1 && proof.data && !proof.data.eligible
              ? "This wallet isn't on the whitelist. Wait for the public phase."
              : derived.walletLeft === 0n
                ? `You've reached the ${PHASES[phase].toLowerCase()} limit for this wallet.`
                : null;

  const busy = confirmingInWallet || receipt.isLoading;

  return (
    <Panel>
      {/* phase + supply */}
      <div className="flex items-center justify-between gap-3">
        <span className={`rounded-full border-2 border-ink px-3 py-1 text-sm font-semibold ${phase === 0 ? "bg-parchment" : "bg-moss"}`}>
          {phase === 0 ? "Mint closed" : `${PHASES[phase]} phase`}
        </span>
        <span className="text-sm text-ink/70">{s.revealed ? "Revealed" : "Unrevealed"}</span>
      </div>

      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-ink/70">Minted</span>
          <span className="font-display text-3xl font-bold tabular-nums" aria-live="polite">
            {s.totalMinted.toLocaleString()} <span className="text-lg text-ink/50">/ {s.maxSupply.toLocaleString()}</span>
          </span>
        </div>
        <div
          className="mt-2 h-4 overflow-hidden rounded-full border-2 border-ink bg-parchment"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={derived.pct}
          aria-label="Supply minted"
        >
          <div className="h-full bg-lantern transition-[width] duration-700" style={{ width: `${derived.pct}%` }} />
        </div>
      </div>

      {/* pricing */}
      <dl className="mt-6 grid grid-cols-2 gap-3">
        <PriceTile label="Whitelist price" value={`${formatEth(s.whitelistPrice)} ETH`} active={phase === 1} />
        <PriceTile label="Public price" value={`${formatEth(s.publicPrice)} ETH`} active={phase === 2} />
        <PriceTile label="Whitelist limit" value={`${s.whitelistLimit.toString()} per wallet`} active={phase === 1} />
        <PriceTile label="Public limit" value={`${s.publicLimit.toString()} per wallet`} active={phase === 2} />
      </dl>

      <div className="mt-7 border-t-2 border-dashed border-ink/25 pt-6">
        {derived.soldOut ? (
          <div className="text-center">
            <p className="font-display text-2xl font-bold">Every lantern is lit.</p>
            <p className="mt-1 text-ink/75">The collection is sold out. Find a Lunetta on a secondary marketplace.</p>
          </div>
        ) : !isConnected ? (
          <WalletButton size="lg" />
        ) : wrongChain ? (
          <button className="btn-lantern w-full" onClick={() => switchChain({ chainId: chainConfig.chainId })} disabled={switching}>
            {switching ? "Switching…" : `Switch to ${chainConfig.chain.name}`}
          </button>
        ) : (
          <>
            {phase !== 0 && (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-ink/70">Quantity</p>
                  <p className="text-xs text-ink/60">
                    {derived.walletLeft.toString()} left for this wallet ({derived.minted.toString()}/{derived.limit.toString()} used)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StepButton label="Decrease quantity" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1 || busy}>
                    −
                  </StepButton>
                  <output className="w-10 text-center font-display text-2xl font-bold tabular-nums" aria-live="polite">
                    {quantity}
                  </output>
                  <StepButton
                    label="Increase quantity"
                    onClick={() => setQuantity((q) => Math.min(Math.max(derived.maxQty, 1), q + 1))}
                    disabled={quantity >= derived.maxQty || busy}
                  >
                    +
                  </StepButton>
                </div>
              </div>
            )}

            {phase !== 0 && (
              <div className="mt-5 flex items-baseline justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-display text-2xl font-bold">{formatEth(total)} ETH</span>
              </div>
            )}

            {rootMismatch && (
              <p className="mt-4 rounded-2xl border-2 border-ink bg-lantern/40 p-3 text-sm font-semibold">
                The whitelist is being updated. If your mint fails, try again in a few minutes.
              </p>
            )}

            {disabledReason && <p className="mt-4 text-sm font-semibold text-ink/75">{disabledReason}</p>}

            <button
              className="btn-lantern mt-5 w-full"
              onClick={mint}
              disabled={Boolean(disabledReason) || busy || derived.maxQty < 1}
            >
              {confirmingInWallet ? "Confirm in your wallet…" : receipt.isLoading ? "Minting…" : `Mint ${quantity}`}
            </button>
            <p className="mt-2 text-center text-xs text-ink/60">Plus network gas. Balance: {balance.data ? `${formatEth(balance.data.value)} ETH` : "…"}</p>
          </>
        )}
      </div>

      {/* transaction status */}
      <div aria-live="polite" className="empty:hidden">
        {txHash && receipt.isLoading && (
          <StatusBox tone="info">
            Transaction sent.{" "}
            <a className="underline" href={explorerTx(txHash)} target="_blank" rel="noopener noreferrer">
              View on explorer
            </a>
          </StatusBox>
        )}
        {receipt.isSuccess && (
          <StatusBox tone="success">
            Your Lunetta{quantity > 1 ? "s are" : " is"} awake!{" "}
            <Link href="/gallery" className="underline">Open your gallery</Link>
            {" · "}
            <a className="underline" href={explorerTx(txHash!)} target="_blank" rel="noopener noreferrer">Receipt</a>
          </StatusBox>
        )}
        {receipt.isError && <StatusBox tone="error">{friendlyError(receipt.error)}</StatusBox>}
        {localError && <StatusBox tone="error">{localError}</StatusBox>}
      </div>
    </Panel>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="card-paper p-6 sm:p-8">{children}</div>;
}

function PriceTile({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className={`rounded-2xl border-2 p-3 ${active ? "border-ink bg-lantern/30" : "border-ink/20"}`}>
      <dt className="text-xs font-semibold text-ink/65">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}

function StepButton({ label, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="h-11 w-11 rounded-full border-2 border-ink bg-paper text-xl font-bold shadow-[2px_2px_0_0_#12142B] disabled:opacity-40"
      {...rest}
    >
      {children}
    </button>
  );
}

function StatusBox({ tone, children }: { tone: "info" | "success" | "error"; children: ReactNode }) {
  const bg = tone === "success" ? "bg-moss/40" : tone === "error" ? "bg-ember/25" : "bg-parchment";
  return (
    <p role={tone === "error" ? "alert" : undefined} className={`mt-5 rounded-2xl border-2 border-ink p-4 text-sm font-semibold ${bg}`}>
      {children}
    </p>
  );
}
