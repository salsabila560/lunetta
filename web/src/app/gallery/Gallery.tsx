"use client";

/* eslint-disable @next/next/no-img-element -- IPFS gateways vary; plain <img> avoids image-optimizer allowlists */
import Link from "next/link";
import type { ReactNode } from "react";
import { useQueries } from "@tanstack/react-query";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { WalletButton } from "@/components/WalletButton";
import { CAT_PALETTES, LunettaCat } from "@/components/illustrations";
import { lunettaAbi } from "@/lib/abi";
import { chainConfig } from "@/lib/config";
import { fetchMetadata, ipfsToHttp, type NftMetadata } from "@/lib/ipfs";
import { lunettaContract } from "@/lib/wagmi";

export function Gallery() {
  const { address, isConnected } = useAccount();

  const owned = useReadContract({
    ...lunettaContract,
    abi: lunettaAbi,
    functionName: "tokensOfOwner",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) && chainConfig.isContractConfigured },
  });

  const ids = owned.data ?? [];

  const uris = useReadContracts({
    contracts: ids.map((id) => ({ ...lunettaContract, abi: lunettaAbi, functionName: "tokenURI" as const, args: [id] as const })),
    query: { enabled: ids.length > 0 },
  });

  const metadata = useQueries({
    queries: ids.map((id, i) => {
      const uri = uris.data?.[i]?.result as string | undefined;
      return {
        queryKey: ["metadata", id.toString(), uri],
        queryFn: () => fetchMetadata(uri!),
        enabled: Boolean(uri),
        staleTime: 5 * 60_000,
        retry: 1,
      };
    }),
  });

  if (!chainConfig.isContractConfigured) {
    return <Empty title="The collection isn't live yet" body="Your keepers will appear here after the mint." />;
  }

  if (!isConnected) {
    return (
      <div className="card-paper max-w-md p-7">
        <p className="font-display text-2xl font-bold">Connect to see your Lunettas</p>
        <p className="mt-2 text-ink/75">We only read which tokens your wallet holds.</p>
        <div className="mt-6">
          <WalletButton size="lg" />
        </div>
      </div>
    );
  }

  if (owned.isLoading) {
    return (
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading your Lunettas">
        {[0, 1, 2].map((i) => (
          <li key={i} className="card-paper h-96 animate-pulse" />
        ))}
      </ul>
    );
  }

  if (owned.isError) {
    return (
      <div className="card-paper max-w-md p-7">
        <p className="font-semibold">Couldn&apos;t load your tokens.</p>
        <button className="btn-paper mt-4" onClick={() => owned.refetch()}>Retry</button>
      </div>
    );
  }

  if (ids.length === 0) {
    return (
      <Empty
        title="No Lunettas in this wallet yet"
        body="Mint one, or switch to the wallet that holds yours."
        action={<Link href="/mint" className="btn-lantern mt-6">Go to mint</Link>}
      />
    );
  }

  return (
    <>
      <p className="mb-6 text-paper/70">
        {ids.length} {ids.length === 1 ? "Lunetta" : "Lunettas"} found
      </p>
      <ul className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
        {ids.map((id, i) => (
          <li key={id.toString()}>
            <TokenCard id={id} meta={metadata[i]?.data} loading={metadata[i]?.isLoading ?? true} failed={metadata[i]?.isError ?? false} />
          </li>
        ))}
      </ul>
    </>
  );
}

function TokenCard({ id, meta, loading, failed }: { id: bigint; meta?: NftMetadata; loading: boolean; failed: boolean }) {
  const image = meta?.image ? ipfsToHttp(meta.image) : "";
  return (
    <article className="card-paper overflow-hidden p-4">
      <div className="paper-grain aspect-square overflow-hidden rounded-2xl border-2 border-ink bg-parchment">
        {image ? (
          <img src={image} alt={meta?.name ?? `Lunetta #${id}`} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className={`flex h-full items-center justify-center p-6 ${loading ? "animate-pulse" : ""}`}>
            <LunettaCat palette={CAT_PALETTES.paper} sleeping className="w-3/4 opacity-80" />
          </div>
        )}
      </div>
      <h2 className="mt-4 font-display text-xl font-bold">{meta?.name ?? `Lunetta #${id.toString()}`}</h2>
      {failed && <p className="mt-1 text-sm text-ink/60">Metadata is still loading from IPFS. Check back soon.</p>}
      {meta?.attributes && meta.attributes.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {meta.attributes.map((a) => (
            <li key={a.trait_type} className="rounded-full border-2 border-ink/20 px-3 py-1 text-xs">
              <span className="text-ink/60">{a.trait_type}:</span> <span className="font-semibold">{String(a.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card-paper max-w-md p-7">
      <LunettaCat palette={CAT_PALETTES.dusk} sleeping className="w-32" />
      <p className="mt-4 font-display text-2xl font-bold">{title}</p>
      <p className="mt-2 text-ink/75">{body}</p>
      {action}
    </div>
  );
}
