"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  encodeAbiParameters,
  encodeDeployData,
  erc20Abi,
  formatEther,
  formatUnits,
  getAddress,
  isAddress,
  parseUnits,
  zeroAddress,
  type Address,
  type Hash,
} from "viem";
import {
  useAccount,
  useBalance,
  useDeployContract,
  usePublicClient,
  useReadContracts,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { WalletButton } from "@/components/WalletButton";
import { lunettaAbi } from "@/lib/abi";
import { COLLECTION_SIZE } from "@/lib/collection-info";
import { chainConfig, explorerAddress, explorerTx } from "@/lib/config";
import { friendlyError } from "@/lib/errors";
import { lunettaBytecode } from "@/lib/lunetta-bytecode";

const STORAGE_KEY = `lunetta:admin:contract:${chainConfig.chainId}`;
const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";

/** Accepts "1000000", "1.000.000" or "1,000,000" (thousand separators) and "0.5" / "0,5" (decimals). */
function parseTokenAmount(input: string, decimals: number) {
  let v = input.replace(/\s/g, "");
  if (/^\d{1,3}([.,]\d{3})+$/.test(v)) v = v.replace(/[.,]/g, "");
  else v = v.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(v)) throw new Error(`Jumlah token tidak valid: ${input}`);
  return parseUnits(v, decimals);
}

type TierRow = { end: string; price: string };

const DEFAULT_TIERS: TierRow[] = [
  { end: "100", price: "1000000" },
  { end: "200", price: "2000000" },
  { end: "300", price: "5000000" },
  { end: String(COLLECTION_SIZE), price: "10000000" },
];

/** Validates the tier rows and converts them to contract arguments. */
function buildTiers(rows: TierRow[], decimals: number) {
  const ends: bigint[] = [];
  const prices: bigint[] = [];
  rows.forEach((r, i) => {
    if (!/^\d+$/.test(r.end)) throw new Error(`Tingkat ${i + 1}: "sampai NFT #" harus angka.`);
    const end = BigInt(r.end);
    if (i > 0 && end <= ends[i - 1]!) throw new Error(`Tingkat ${i + 1}: nomor akhir harus lebih besar dari tingkat sebelumnya.`);
    ends.push(end);
    prices.push(parseTokenAmount(r.price, decimals));
  });
  if (ends.length === 0) throw new Error("Minimal satu tingkat harga.");
  if (ends[ends.length - 1]! < BigInt(COLLECTION_SIZE)) throw new Error(`Tingkat terakhir harus sampai #${COLLECTION_SIZE}.`);
  return [ends, prices] as const;
}

function TierEditor({ rows, onChange, unit }: { rows: TierRow[]; onChange: (rows: TierRow[]) => void; unit: string }) {
  const set = (i: number, key: keyof TierRow, v: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-semibold text-ink/60">
        <span>Sampai NFT #</span>
        <span>Harga per NFT ({unit})</span>
        <span className="w-8" />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
          <input className="field" inputMode="numeric" value={r.end} onChange={(e) => set(i, "end", e.target.value.trim())} aria-label={`Tingkat ${i + 1} sampai NFT nomor`} />
          <input className="field" inputMode="decimal" value={r.price} onChange={(e) => set(i, "price", e.target.value.trim())} aria-label={`Tingkat ${i + 1} harga`} />
          <button
            type="button"
            className="h-8 w-8 rounded-full border-2 border-ink/30 text-sm font-bold disabled:opacity-30"
            disabled={rows.length <= 1}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
            aria-label={`Hapus tingkat ${i + 1}`}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="text-sm font-semibold underline" onClick={() => onChange([...rows, { end: "", price: "" }])}>
        + Tambah tingkat
      </button>
      <p className="text-xs text-ink/60">
        Contoh: #1–100 = 1.000.000, #101–200 = 2.000.000. Kalau satu transaksi melewati batas tingkat, tiap NFT dihitung dengan harga tingkatnya.
      </p>
    </div>
  );
}

function fmtTokens(units: bigint, decimals: number) {
  return Number(formatUnits(units, decimals)).toLocaleString("id-ID", { maximumFractionDigits: 4 });
}

function loadSaved(): Address | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v && isAddress(v) ? getAddress(v) : null;
  } catch {
    return null;
  }
}

function save(addr: Address) {
  try {
    window.localStorage.setItem(STORAGE_KEY, addr);
  } catch {
    /* storage unavailable */
  }
}

export function AdminPanel() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [contract, setContract] = useState<Address | null>(chainConfig.isContractConfigured ? chainConfig.contractAddress : null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!chainConfig.isContractConfigured) setContract(loadSaved());
  }, []);

  if (!isConnected) {
    return (
      <Card>
        <p className="mb-4 font-semibold">Hubungkan wallet pemilik untuk mulai.</p>
        <WalletButton size="lg" />
      </Card>
    );
  }

  if (chainId !== chainConfig.chainId) {
    return (
      <Card>
        <p className="font-semibold">Wallet-mu sedang di jaringan lain.</p>
        <button className="btn-lantern mt-4 w-full" disabled={switching} onClick={() => switchChain({ chainId: chainConfig.chainId })}>
          {switching ? "Mengganti…" : `Pindah ke ${chainConfig.chain.name}`}
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-sm text-ink/70">Jaringan</p>
        <p className="font-display text-xl font-bold">
          {chainConfig.chain.name} <span className="text-base font-normal text-ink/60">(chain ID {chainConfig.chainId})</span>
        </p>
        <p className="mt-2 text-sm text-ink/70">
          Koleksi: {COLLECTION_SIZE.toLocaleString()} Lunetta. Gambar dan metadata dilayani website ini dan baru terbuka setelah tiap token di-mint.
        </p>
      </Card>

      {!contract ? (
        <>
          <DeployCard
            owner={address!}
            onDeployed={(a) => {
              save(a);
              setContract(a);
            }}
          />
          <Card>
            <p className="font-semibold">Sudah pernah deploy?</p>
            <div className="mt-3 flex gap-2">
              <input className="field font-mono text-sm" placeholder="0x… alamat kontrak" value={manual} onChange={(e) => setManual(e.target.value.trim())} />
              <button
                className="btn-paper !px-5"
                onClick={() => {
                  if (isAddress(manual)) {
                    const a = getAddress(manual);
                    save(a);
                    setContract(a);
                  }
                }}
              >
                Pakai
              </button>
            </div>
          </Card>
        </>
      ) : (
        <ManageCard contract={contract} me={address!} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- deploy

function DeployCard({ owner, onDeployed }: { owner: Address; onDeployed: (a: Address) => void }) {
  const [tiers, setTiers] = useState<TierRow[]>(DEFAULT_TIERS);
  const [walletLimit, setWalletLimit] = useState("5");
  const [royaltyPct, setRoyaltyPct] = useState("5");
  const [royaltyTo, setRoyaltyTo] = useState<string>(owner);
  const [ownerTo, setOwnerTo] = useState<string>(owner);
  const [formError, setFormError] = useState<string | null>(null);
  const [args, setArgs] = useState<readonly unknown[] | null>(null);

  const { deployContractAsync, data: hash, isPending, error, reset } = useDeployContract();
  const publicClient = usePublicClient({ chainId: chainConfig.chainId });
  const [estimating, setEstimating] = useState(false);
  const receipt = useWaitForTransactionReceipt({ hash, chainId: chainConfig.chainId });
  const deployed =
    receipt.data?.status === "success" && receipt.data.contractAddress ? getAddress(receipt.data.contractAddress) : null;
  const deployFailed = receipt.data?.status === "reverted" || receipt.isError;

  function buildArgs() {
    const bps = Math.round(Number(royaltyPct) * 100);
    if (!(bps >= 0 && bps <= 1000)) throw new Error("Royalti harus antara 0 dan 10%.");
    if (!isAddress(royaltyTo)) throw new Error("Alamat penerima royalti tidak valid.");
    if (!isAddress(ownerTo)) throw new Error("Alamat pemilik kontrak tidak valid.");
    if (!/^\d+$/.test(walletLimit)) throw new Error("Batas per wallet harus angka.");
    const limit = BigInt(walletLimit);
    if (limit < 1n) throw new Error("Batas per wallet minimal 1.");
    // Token belum launch, jadi diasumsikan 18 desimal (standar ERC-20). Bisa diubah setelah token dipasang.
    const [ends, prices] = buildTiers(tiers, 18);
    return [
      "Lunetta",
      "LUNA",
      BigInt(COLLECTION_SIZE),
      ends,
      prices,
      limit,
      `${window.location.origin}/api/metadata/hidden.json`,
      getAddress(royaltyTo),
      BigInt(bps),
      getAddress(ownerTo),
    ] as const;
  }

  async function deploy() {
    setFormError(null);
    reset();
    let built: ReturnType<typeof buildArgs>;
    try {
      built = buildArgs();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Isian belum benar.");
      return;
    }
    setArgs(built);
    // Some wallets cap gas at ~1.2M on custom chains, which is far below what deploying this
    // contract needs (~3.5M, mostly for storing the code). Estimate it ourselves and add headroom.
    let gas = 6_000_000n;
    setEstimating(true);
    try {
      if (publicClient) {
        const data = encodeDeployData({ abi: lunettaAbi, bytecode: lunettaBytecode, args: built });
        const est = await publicClient.estimateGas({ account: owner, data });
        const padded = (est * 13n) / 10n;
        gas = padded > 4_500_000n ? padded : 4_500_000n;
      }
    } catch {
      /* fall back to the fixed limit above */
    } finally {
      setEstimating(false);
    }
    try {
      await deployContractAsync({ abi: lunettaAbi, bytecode: lunettaBytecode, args: built, chainId: chainConfig.chainId, gas });
    } catch {
      /* shown below */
    }
  }

  useEffect(() => {
    if (deployed) onDeployed(deployed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployed]);

  const encodedArgs =
    args && deployed
      ? encodeAbiParameters(
          [
            { type: "string" }, { type: "string" }, { type: "uint256" }, { type: "uint256[]" }, { type: "uint256[]" }, { type: "uint256" },
            { type: "string" }, { type: "address" }, { type: "uint96" }, { type: "address" },
          ],
          args as never,
        ).slice(2)
      : null;

  return (
    <Card>
      <h2 className="font-display text-2xl font-bold">1. Deploy kontrak</h2>
      <p className="mt-1 text-sm text-ink/70">
        Wallet pembayar gas: <span className="font-mono">{owner}</span>. Supply dikunci {COLLECTION_SIZE} agar cocok dengan koleksi.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-semibold">Harga bertingkat (jumlah token)</p>
          <TierEditor rows={tiers} onChange={setTiers} unit="token" />
        </div>
        <Field label="Batas mint per wallet" value={walletLimit} onChange={setWalletLimit} />
        <Field label="Royalti (%)" value={royaltyPct} onChange={setRoyaltyPct} />
        <Field label="Penerima royalti" value={royaltyTo} onChange={setRoyaltyTo} mono />
        <div className="sm:col-span-2">
          <Field label="Pemilik kontrak (owner)" value={ownerTo} onChange={setOwnerTo} mono />
          <p className="mt-1 text-xs text-ink/60">
            Wallet yang boleh mengelola kontrak di panel ini. Boleh beda dengan wallet yang membayar gas deploy, misalnya deploy pakai
            MetaMask tapi pemiliknya wallet utama-mu.
          </p>
        </div>
      </div>
      <p className="mt-4 rounded-2xl border-2 border-ember bg-ember/15 p-3 text-sm">
        Mint dibayar dengan <b>token proyek</b>, bukan ETH. Setiap token pembayaran langsung dikirim ke alamat burn{" "}
        <span className="font-mono">0x…dEaD</span> di transaksi yang sama, jadi tidak masuk ke kontrak atau ke wallet-mu. Alamat token
        dipasang setelah deploy (langkah 2), misalnya setelah token-mu launch.
      </p>
      <p className="mt-3 rounded-2xl border-2 border-ink bg-lantern/30 p-3 text-sm">
        Ini mainnet: gas deploy dibayar dengan ETH sungguhan. Harga dan batas masih bisa diubah nanti.
      </p>
      <button className="btn-lantern mt-5 w-full" onClick={deploy} disabled={estimating || isPending || receipt.isLoading}>
        {estimating ? "Menghitung gas…" : isPending ? "Konfirmasi di wallet…" : receipt.isLoading ? "Menunggu blok…" : "Deploy Lunetta"}
      </button>
      <p className="mt-2 text-center text-xs text-ink/60">
        Batas gas diatur otomatis (sekitar 4–5 juta). Deploy butuh gas besar, jadi pakai wallet yang mengikuti batas gas dari website
        (misalnya MetaMask). Bitget Wallet memaksa batas 1,2 juta, jadi deploy dari Bitget pasti gagal. Biayanya tetap kecil.
      </p>
      {formError && <Status tone="error">{formError}</Status>}
      {error && <Status tone="error">{friendlyError(error)}</Status>}
      {deployFailed && hash && (
        <Status tone="error">
          Deploy gagal di jaringan (kontrak tidak terbuat), biasanya karena wallet memotong batas gas. Coba deploy dari MetaMask.{" "}
          <a className="underline" href={explorerTx(hash)} target="_blank" rel="noopener noreferrer">Lihat di explorer</a>
        </Status>
      )}
      {hash && !deployed && !deployFailed && (
        <Status tone="info">
          Transaksi terkirim. <a className="underline" href={explorerTx(hash)} target="_blank" rel="noopener noreferrer">Lihat di explorer</a>
        </Status>
      )}
      {deployed && (
        <Status tone="success">
          Kontrak aktif di <span className="break-all font-mono">{deployed}</span>.{" "}
          <a className="underline" href={explorerAddress(deployed)} target="_blank" rel="noopener noreferrer">Buka explorer</a>
          {encodedArgs && (
            <details className="mt-2">
              <summary className="cursor-pointer">Constructor arguments (untuk verifikasi)</summary>
              <code className="mt-1 block break-all text-xs font-normal">{encodedArgs}</code>
            </details>
          )}
        </Status>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- manage

function ManageCard({ contract, me }: { contract: Address; me: Address }) {
  const c = { address: contract, abi: lunettaAbi, chainId: chainConfig.chainId } as const;
  const reads = useReadContracts({
    contracts: [
      { ...c, functionName: "owner" },
      { ...c, functionName: "mintOpen" },
      { ...c, functionName: "totalMinted" },
      { ...c, functionName: "maxSupply" },
      { ...c, functionName: "revealed" },
      { ...c, functionName: "currentPrice" },
      { ...c, functionName: "walletLimit" },
      { ...c, functionName: "pendingOwner" },
      { ...c, functionName: "paymentToken" },
      { ...c, functionName: "paymentTokenLocked" },
      { ...c, functionName: "totalBurned" },
    ],
    query: { refetchInterval: 8_000 },
  });
  const balance = useBalance({ address: contract, chainId: chainConfig.chainId, query: { refetchInterval: 8_000 } });

  const [owner, mintOpen, minted, max, revealed, price, walletLimit, , payToken, payLocked, burned] = (reads.data ?? []).map(
    (r) => r.result,
  );
  const isOwner = typeof owner === "string" && owner.toLowerCase() === me.toLowerCase();
  const tokenSet = typeof payToken === "string" && payToken !== zeroAddress;
  const tokenReads = useReadContracts({
    contracts: [
      { address: tokenSet ? (payToken as Address) : zeroAddress, abi: erc20Abi, functionName: "symbol", chainId: chainConfig.chainId },
      { address: tokenSet ? (payToken as Address) : zeroAddress, abi: erc20Abi, functionName: "decimals", chainId: chainConfig.chainId },
      {
        address: tokenSet ? (payToken as Address) : zeroAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [BURN_ADDRESS],
        chainId: chainConfig.chainId,
      },
    ],
    query: { enabled: tokenSet, refetchInterval: 15_000 },
  });
  const [symR, decR, deadR] = tokenSet && tokenReads.data ? tokenReads.data.map((r) => r.result) : [];
  const sym = typeof symR === "string" ? symR : "token";
  const dec = typeof decR === "number" ? decR : 18;

  const { writeContractAsync, data: hash, isPending, error, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash, chainId: chainConfig.chainId });
  useEffect(() => {
    if (receipt.isSuccess) {
      reads.refetch();
      balance.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess]);

  const busy = isPending || receipt.isLoading;
  const [inputError, setInputError] = useState<string | null>(null);
  async function send(fn: () => Promise<Hash>) {
    reset();
    setInputError(null);
    try {
      await fn();
    } catch (e) {
      // wallet/contract errors are rendered from `error`; input mistakes land here
      if (e instanceof Error && (e.message.startsWith("Jumlah token") || e.message.startsWith("Tingkat") || e.message.startsWith("Minimal"))) {
        setInputError(e.message);
      }
    }
  }

  const tiersRead = useReadContracts({ contracts: [{ ...c, functionName: "priceTiers" }], query: { refetchInterval: 30_000 } });
  const onchainTiers = tiersRead.data?.[0]?.result as readonly [readonly bigint[], readonly bigint[]] | undefined;
  const [tierRows, setTierRows] = useState<TierRow[] | null>(null);
  const [newLimit, setNewLimit] = useState("");
  const [tokenInput, setTokenInput] = useState<string>(chainConfig.tokenAddress ?? "");
  const [mintTo, setMintTo] = useState<string>(me);
  const [mintQty, setMintQty] = useState("1");

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-bold">Status kontrak</h2>
          <a className="text-sm underline" href={explorerAddress(contract)} target="_blank" rel="noopener noreferrer">
            Explorer
          </a>
        </div>
        <p className="mt-1 break-all font-mono text-sm">{contract}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Stat label="Mint" value={mintOpen === undefined ? "…" : mintOpen ? "Terbuka (publik)" : "Tutup"} />
          <Stat label="Terjual" value={minted !== undefined && max !== undefined ? `${String(minted)} / ${String(max)}` : "…"} />
          <Stat
            label="Harga sekarang / batas per wallet"
            value={typeof price === "bigint" && typeof walletLimit === "bigint" ? `${fmtTokens(price, dec)} ${sym} / ${walletLimit} NFT` : "…"}
          />
          <Stat label="Token pembayaran" value={payToken === undefined ? "…" : tokenSet ? `${sym}${payLocked ? " (terkunci)" : ""}` : "Belum dipasang"} />
          <Stat label="Terbakar lewat mint" value={typeof burned === "bigint" ? `${fmtTokens(burned, dec)} ${sym}` : "…"} />
          <Stat label="Total di 0x…dEaD" value={typeof deadR === "bigint" ? `${fmtTokens(deadR, dec)} ${sym}` : tokenSet ? "…" : "-"} />
          <Stat label="Metadata" value={revealed === undefined ? "…" : revealed ? "Tersambung" : "Belum disambung"} />
          <Stat label="Kamu pemilik?" value={owner === undefined ? "…" : isOwner ? "Ya" : "Bukan"} />
        </dl>
        {!chainConfig.isContractConfigured && (
          <p className="mt-4 rounded-2xl border-2 border-ink bg-lantern/30 p-3 text-sm">
            Website publik belum tahu alamat ini. Kirim alamat kontrak ke Claude (atau isi <code>NEXT_PUBLIC_CONTRACT_ADDRESS</code> di Vercel)
            agar halaman mint dan galeri aktif.
          </p>
        )}
      </Card>

      {!isOwner && owner !== undefined ? (
        <Card>
          <p className="font-semibold">Wallet ini bukan pemilik kontrak, jadi tombol admin disembunyikan.</p>
        </Card>
      ) : (
        <>
          {!tokenSet && (
            <Action
              title="2. Pasang token pembayaran"
              desc="Isi alamat kontrak token-mu (ERC-20 di Robinhood Chain). Pembeli membayar mint dengan token ini dan semuanya langsung di-burn."
            >
              <TokenInput value={tokenInput} onChange={setTokenInput} />
              <button
                className="btn-lantern mt-3 w-full"
                disabled={busy || !isAddress(tokenInput)}
                onClick={() => send(() => writeContractAsync({ ...c, functionName: "setPaymentToken", args: [getAddress(tokenInput)] }))}
              >
                Pasang token
              </button>
            </Action>
          )}

          {revealed === false && (
            <Action title="3. Sambungkan metadata" desc="Arahkan tokenURI ke website ini. Gambar tiap token tetap tersembunyi sampai token itu di-mint.">
              <button
                className="btn-lantern w-full"
                disabled={busy}
                onClick={() => send(() => writeContractAsync({ ...c, functionName: "reveal", args: [`${window.location.origin}/api/metadata/`] }))}
              >
                Sambungkan metadata
              </button>
            </Action>
          )}

          {revealed === true && mintOpen === false && tokenSet && (
            <Action title="4. Buka mint publik" desc="Setelah ini tombol Mint di website langsung berfungsi untuk semua orang.">
              <button
                className="btn-lantern w-full"
                disabled={busy}
                onClick={() => send(() => writeContractAsync({ ...c, functionName: "setMintOpen", args: [true] }))}
              >
                Buka mint publik
              </button>
            </Action>
          )}

          <Action title="Buka / tutup mint" desc="Mint publik untuk semua orang, tanpa whitelist. Tutup kapan saja kalau perlu jeda.">
            <div className="grid grid-cols-2 gap-2">
              <button
                className={mintOpen ? "btn-lantern !px-3" : "btn-paper !px-3"}
                disabled={busy || mintOpen === true}
                onClick={() => send(() => writeContractAsync({ ...c, functionName: "setMintOpen", args: [true] }))}
              >
                Buka
              </button>
              <button
                className={mintOpen === false ? "btn-lantern !px-3" : "btn-paper !px-3"}
                disabled={busy || mintOpen === false}
                onClick={() => send(() => writeContractAsync({ ...c, functionName: "setMintOpen", args: [false] }))}
              >
                Tutup
              </button>
            </div>
          </Action>

          {tokenSet && !payLocked && (
            <Action
              title="Token pembayaran"
              desc="Ganti token kalau salah pasang. Setelah yakin, kunci supaya pembeli tahu token tidak bisa diganti lagi (permanen)."
            >
              <p className="break-all font-mono text-xs">{String(payToken)}</p>
              <TokenInput value={tokenInput} onChange={setTokenInput} />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className="btn-paper !px-3"
                  disabled={busy || !isAddress(tokenInput)}
                  onClick={() => send(() => writeContractAsync({ ...c, functionName: "setPaymentToken", args: [getAddress(tokenInput)] }))}
                >
                  Ganti token
                </button>
                <button
                  className="btn-paper !px-3"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Kunci ${sym} sebagai token pembayaran selamanya? Ini tidak bisa dibatalkan.`)) {
                      send(() => writeContractAsync({ ...c, functionName: "lockPaymentToken" }));
                    }
                  }}
                >
                  Kunci token
                </button>
              </div>
            </Action>
          )}

          <Action title="Harga bertingkat" desc={`Dalam jumlah ${sym} per NFT (bukan ETH). Harga naik sesuai nomor NFT yang di-mint. Semua pembayaran di-burn.`}>
            {onchainTiers && (
              <ol className="mb-4 space-y-1 text-sm">
                {onchainTiers[0].map((end, i) => (
                  <li key={i} className="flex justify-between rounded-xl border-2 border-ink/15 px-3 py-1.5">
                    <span>
                      #{i === 0 ? "1" : String(onchainTiers[0][i - 1]! + 1n)} – #{String(end)}
                    </span>
                    <span className="font-semibold">
                      {fmtTokens(onchainTiers[1][i]!, dec)} {sym}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {tierRows ? (
              <>
                <TierEditor rows={tierRows} onChange={setTierRows} unit={sym} />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="btn-paper !px-3" disabled={busy} onClick={() => setTierRows(null)}>
                    Batal
                  </button>
                  <button
                    className="btn-lantern !px-3"
                    disabled={busy}
                    onClick={() =>
                      send(() => {
                        const [ends, prices] = buildTiers(tierRows, dec);
                        return writeContractAsync({ ...c, functionName: "setPriceTiers", args: [ends, prices] });
                      })
                    }
                  >
                    Simpan harga
                  </button>
                </div>
              </>
            ) : (
              <button
                className="btn-paper w-full"
                disabled={busy || !onchainTiers}
                onClick={() =>
                  onchainTiers &&
                  setTierRows(onchainTiers[0].map((end, i) => ({ end: String(end), price: formatUnits(onchainTiers[1][i]!, dec) })))
                }
              >
                Ubah harga
              </button>
            )}
          </Action>

          <Action title="Ubah batas per wallet" desc="Jumlah maksimal NFT yang boleh di-mint satu wallet.">
            <Field label="Batas per wallet" value={newLimit} onChange={setNewLimit} placeholder={typeof walletLimit === "bigint" ? String(walletLimit) : ""} />
            <button
              className="btn-paper mt-3 w-full"
              disabled={busy || !/^\d+$/.test(newLimit) || Number(newLimit) < 1}
              onClick={() => send(() => writeContractAsync({ ...c, functionName: "setWalletLimit", args: [BigInt(newLimit)] }))}
            >
              Simpan batas
            </button>
          </Action>

          <Action title="Mint untuk tim" desc="Gratis untuk pemilik. Maksimal 30 per transaksi agar transfer tetap murah.">
            <div className="grid grid-cols-[1fr_90px] gap-3">
              <Field label="Ke alamat" value={mintTo} onChange={setMintTo} mono />
              <Field label="Jumlah" value={mintQty} onChange={setMintQty} />
            </div>
            <button
              className="btn-paper mt-3 w-full"
              disabled={busy || !isAddress(mintTo) || !(Number(mintQty) >= 1 && Number(mintQty) <= 30)}
              onClick={() =>
                send(() => writeContractAsync({ ...c, functionName: "ownerMint", args: [getAddress(mintTo), BigInt(mintQty)] }))
              }
            >
              Mint
            </button>
          </Action>

          {balance.data && balance.data.value > 0n && (
            <Action title="ETH nyasar" desc="Mint tidak menerima ETH, tapi kalau ada ETH yang terkirim ke kontrak, bisa ditarik di sini.">
              <button
                className="btn-paper w-full"
                disabled={busy}
                onClick={() => send(() => writeContractAsync({ ...c, functionName: "withdraw", args: [me] }))}
              >
                Tarik {formatEther(balance.data.value)} ETH
              </button>
            </Action>
          )}
        </>
      )}

      <div aria-live="polite">
        {inputError && <Status tone="error">{inputError}</Status>}
        {error && <Status tone="error">{friendlyError(error)}</Status>}
        {hash && receipt.isLoading && (
          <Status tone="info">
            Menunggu konfirmasi… <a className="underline" href={explorerTx(hash)} target="_blank" rel="noopener noreferrer">Lihat transaksi</a>
          </Status>
        )}
        {hash && receipt.isSuccess && <Status tone="success">Berhasil.</Status>}
      </div>
      <p className="text-center text-xs text-paper/50">Kontrak: {contract === zeroAddress ? "-" : contract}</p>
    </div>
  );
}

// ---------------------------------------------------------------- ui bits

function Card({ children }: { children: ReactNode }) {
  return <div className="card-paper p-6">{children}</div>;
}

function Action({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <Card>
      <h3 className="font-display text-xl font-bold">{title}</h3>
      <p className="mb-4 mt-1 text-sm text-ink/70">{desc}</p>
      {children}
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  mono,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input
        className={`field mt-1 ${mono ? "font-mono text-xs" : ""}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.trim())}
        inputMode={mono ? "text" : "decimal"}
      />
    </label>
  );
}

function TokenInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="mt-3 block text-sm font-semibold">
      Alamat token
      <input className="field mt-1 font-mono text-xs" placeholder="0x… kontrak token" value={value} onChange={(e) => onChange(e.target.value.trim())} />
      {value && !isAddress(value) && <span className="mt-1 block text-xs text-ember">Alamat tidak valid.</span>}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border-2 border-ink/15 p-3">
      <dt className="text-xs text-ink/60">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function Status({ tone, children }: { tone: "info" | "success" | "error"; children: ReactNode }) {
  const bg = tone === "success" ? "bg-moss/40" : tone === "error" ? "bg-ember/25" : "bg-parchment";
  return (
    <div role={tone === "error" ? "alert" : undefined} className={`mt-4 rounded-2xl border-2 border-ink p-3 text-sm font-semibold text-ink ${bg}`}>
      {children}
    </div>
  );
}
