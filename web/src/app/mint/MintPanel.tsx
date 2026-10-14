"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { erc20Abi, formatUnits, zeroAddress } from "viem";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { WalletButton } from "@/components/WalletButton";
import { lunettaAbi } from "@/lib/abi";
import { chainConfig, explorerTx } from "@/lib/config";
import { friendlyError } from "@/lib/errors";
import { lunettaContract } from "@/lib/wagmi";

function formatAmount(units: bigint, decimals: number) {
  const n = Number(formatUnits(units, decimals));
  return n.toLocaleString(undefined, { maximumFractionDigits: n >= 1000 ? 0 : 4 });
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

  const s = state.data;
  const open = s?.mintOpen ?? false;

  // Gas is still paid in ETH; the mint itself is paid in the project token, which is burned.
  const gasBalance = useBalance({ address, chainId: chainConfig.chainId, query: { enabled: Boolean(address) } });

  const tokenAddress = s && s.paymentToken !== zeroAddress ? s.paymentToken : undefined;
  const tokenInfo = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: tokenAddress ?? zeroAddress, abi: erc20Abi, functionName: "symbol", chainId: chainConfig.chainId },
      { address: tokenAddress ?? zeroAddress, abi: erc20Abi, functionName: "decimals", chainId: chainConfig.chainId },
      { address: tokenAddress ?? zeroAddress, abi: erc20Abi, functionName: "balanceOf", args: [address ?? zeroAddress], chainId: chainConfig.chainId },
      {
        address: tokenAddress ?? zeroAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address ?? zeroAddress, lunettaContract.address],
        chainId: chainConfig.chainId,
      },
    ],
    query: { enabled: Boolean(tokenAddress), refetchInterval: 8_000 },
  });
  const [symbol, decimals, tokenBalance, allowance] = tokenAddress && tokenInfo.data ? tokenInfo.data : [undefined, undefined, undefined, undefined];
  const dec = decimals ?? 18;
  const sym = symbol ?? "tokens";

  const publicClient = usePublicClient({ chainId: chainConfig.chainId });
  const [step, setStep] = useState<"idle" | "approving" | "minting">("idle");
  const { writeContractAsync, data: txHash, isPending: confirmingInWallet, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: txHash, chainId: chainConfig.chainId });

  useEffect(() => {
    if (receipt.isSuccess) {
      state.refetch();
      gasBalance.refetch();
      tokenInfo.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess]);

  const derived = useMemo(() => {
    if (!s) return null;
    const price = s.price;
    const limit = s.walletLimit;
    const minted = s.mintedBy;
    const supplyLeft = s.maxSupply - s.totalMinted;
    const walletLeft = limit > minted ? limit - minted : 0n;
    const maxQty = Number(walletLeft < supplyLeft ? walletLeft : supplyLeft);
    const pct = s.maxSupply > 0n ? Number((s.totalMinted * 10_000n) / s.maxSupply) / 100 : 0;
    return { price, limit, minted, supplyLeft, walletLeft, maxQty, pct, soldOut: supplyLeft === 0n };
  }, [s]);

  useEffect(() => {
    if (derived && derived.maxQty > 0 && quantity > derived.maxQty) setQuantity(derived.maxQty);
  }, [derived, quantity]);

  const total = derived ? derived.price * BigInt(quantity) : 0n;
  const wrongChain = isConnected && walletChainId !== chainConfig.chainId;

  const needsToken = total > 0n;
  const needsApproval = needsToken && (allowance ?? 0n) < total;

  async function mint() {
    setLocalError(null);
    reset();
    if (!derived || !address) return;
    if (needsToken && !tokenAddress) {
      setLocalError("The payment token hasn't been set yet. Check back soon.");
      return;
    }
    if (needsToken && tokenBalance !== undefined && tokenBalance < total) {
      setLocalError(`You need ${formatAmount(total, dec)} ${sym} for this mint. Your wallet has ${formatAmount(tokenBalance, dec)}.`);
      return;
    }
    try {
      if (needsApproval && tokenAddress) {
        // Step 1: let the Lunetta contract move exactly this mint's tokens to the burn address.
        setStep("approving");
        const approveHash = await writeContractAsync({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [lunettaContract.address, total],
          chainId: chainConfig.chainId,
        });
        if (!publicClient) throw new Error("No connection to the network. Try again.");
        const r = await publicClient.waitForTransactionReceipt({ hash: approveHash });
        if (r.status !== "success") throw new Error("Approval failed. Try again.");
        await tokenInfo.refetch();
        reset();
      }
      setStep("minting");
      await writeContractAsync({
        ...lunettaContract,
        abi: lunettaAbi,
        functionName: "mint",
        args: [BigInt(quantity)],
      });
    } catch (err) {
      setLocalError(friendlyError(err));
    } finally {
      setStep("idle");
    }
  }

  // ------------------------------------------------------------------ render

  if (!chainConfig.isContractConfigured) {
    return (
      <Panel>
        <p className="font-display text-2xl font-bold">Mint opens soon</p>
        <p className="mt-2 text-ink/75">The Lunetta contract is being deployed on {chainConfig.chain.name}. Minting opens here as soon as it&apos;s live.</p>
        <Link href="/" className="btn-paper mt-6 w-full">Back to the isles</Link>
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
      : !open
        ? "The mint hasn't started yet."
        : derived.soldOut
          ? null
          : derived.walletLeft === 0n
            ? "You've reached the mint limit for this wallet."
            : null;

  const busy = confirmingInWallet || receipt.isLoading || step !== "idle";
  const priceNow = s.price;
  const tokenMissing = priceNow > 0n && !tokenAddress;

  return (
    <Panel>
      {/* status + supply */}
      <div className="flex items-center justify-between gap-3">
        <span className={`rounded-full border-2 border-ink px-3 py-1 text-sm font-semibold ${open ? "bg-moss" : "bg-parchment"}`}>
          {open ? "Public mint live" : "Mint closed"}
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
        <PriceTile label="Price" value={priceNow === 0n ? "Free" : `${formatAmount(priceNow, dec)} ${sym}`} active={open} />
        <PriceTile label="Per wallet" value={`${s.walletLimit.toString()} max`} active={open} />
      </dl>
      <p className="mt-3 rounded-2xl border-2 border-ink bg-ember/15 p-3 text-sm">
        <span className="font-semibold">Every mint burns its payment.</span> Tokens go straight to the burn address
        (0x…dEaD) in the same transaction. Nobody keeps them.
        {s.totalBurned > 0n && (
          <span className="mt-1 block font-semibold">
            Burned so far: {formatAmount(s.totalBurned, dec)} {sym} 🔥
          </span>
        )}
      </p>

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
            {open && (
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

            {open && (
              <div className="mt-5 flex items-baseline justify-between">
                <span className="font-semibold">Total (burned)</span>
                <span className="font-display text-2xl font-bold">{total === 0n ? "Free" : `${formatAmount(total, dec)} ${sym}`}</span>
              </div>
            )}

            {open && tokenMissing && (
              <p className="mt-4 rounded-2xl border-2 border-ink bg-lantern/40 p-3 text-sm font-semibold">
                The payment token isn&apos;t connected yet. Minting opens as soon as it is.
              </p>
            )}

            {disabledReason && <p className="mt-4 text-sm font-semibold text-ink/75">{disabledReason}</p>}

            <button
              className="btn-lantern mt-5 w-full"
              onClick={mint}
              disabled={Boolean(disabledReason) || busy || derived.maxQty < 1 || tokenMissing}
            >
              {step === "approving"
                ? confirmingInWallet
                  ? "Step 1/2: approve in your wallet…"
                  : "Step 1/2: approving…"
                : confirmingInWallet
                  ? needsApproval || step === "minting"
                    ? "Step 2/2: confirm mint in your wallet…"
                    : "Confirm in your wallet…"
                  : receipt.isLoading
                    ? "Minting…"
                    : needsApproval
                      ? `Approve & mint ${quantity}`
                      : `Mint ${quantity}`}
            </button>
            <p className="mt-2 text-center text-xs text-ink/60">
              {tokenAddress && tokenBalance !== undefined ? `Your ${sym}: ${formatAmount(tokenBalance, dec)} · ` : ""}
              Gas is paid in ETH ({gasBalance.data ? Number(formatUnits(gasBalance.data.value, 18)).toLocaleString(undefined, { maximumFractionDigits: 5 }) : "…"} ETH)
            </p>
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
