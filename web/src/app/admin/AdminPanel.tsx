"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  encodeAbiParameters,
  formatEther,
  getAddress,
  isAddress,
  isHex,
  parseEther,
  zeroAddress,
  type Address,
  type Hash,
} from "viem";
import {
  useAccount,
  useBalance,
  useDeployContract,
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
const PHASES = ["Tutup", "Whitelist", "Publik"] as const;

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
  const [wlPrice, setWlPrice] = useState("0.002");
  const [pubPrice, setPubPrice] = useState("0.004");
  const [wlLimit, setWlLimit] = useState("2");
  const [pubLimit, setPubLimit] = useState("5");
  const [royaltyPct, setRoyaltyPct] = useState("5");
  const [royaltyTo, setRoyaltyTo] = useState<string>(owner);
  const [formError, setFormError] = useState<string | null>(null);
  const [args, setArgs] = useState<readonly unknown[] | null>(null);

  const { deployContractAsync, data: hash, isPending, error, reset } = useDeployContract();
  const receipt = useWaitForTransactionReceipt({ hash, chainId: chainConfig.chainId });
  const deployed = receipt.data?.contractAddress ? getAddress(receipt.data.contractAddress) : null;

  function buildArgs() {
    const bps = Math.round(Number(royaltyPct) * 100);
    if (!(bps >= 0 && bps <= 1000)) throw new Error("Royalti harus antara 0 dan 10%.");
    if (!isAddress(royaltyTo)) throw new Error("Alamat penerima royalti tidak valid.");
    const wl = BigInt(wlLimit);
    const pub = BigInt(pubLimit);
    if (wl < 1n || pub < 1n) throw new Error("Batas per wallet minimal 1.");
    return [
      "Lunetta",
      "LUNA",
      BigInt(COLLECTION_SIZE),
      parseEther(wlPrice),
      parseEther(pubPrice),
      wl,
      pub,
      `${window.location.origin}/api/metadata/hidden.json`,
      getAddress(royaltyTo),
      BigInt(bps),
      owner,
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
    try {
      await deployContractAsync({ abi: lunettaAbi, bytecode: lunettaBytecode, args: built, chainId: chainConfig.chainId });
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
            { type: "string" }, { type: "string" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" },
            { type: "uint256" }, { type: "uint256" }, { type: "string" }, { type: "address" }, { type: "uint96" }, { type: "address" },
          ],
          args as never,
        ).slice(2)
      : null;

  return (
    <Card>
      <h2 className="font-display text-2xl font-bold">1. Deploy kontrak</h2>
      <p className="mt-1 text-sm text-ink/70">
        Pemilik: <span className="font-mono">{owner}</span>. Supply dikunci {COLLECTION_SIZE} agar cocok dengan koleksi.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Harga whitelist (ETH)" value={wlPrice} onChange={setWlPrice} />
        <Field label="Harga publik (ETH)" value={pubPrice} onChange={setPubPrice} />
        <Field label="Batas whitelist / wallet" value={wlLimit} onChange={setWlLimit} />
        <Field label="Batas publik / wallet" value={pubLimit} onChange={setPubLimit} />
        <Field label="Royalti (%)" value={royaltyPct} onChange={setRoyaltyPct} />
        <Field label="Penerima royalti" value={royaltyTo} onChange={setRoyaltyTo} mono />
      </div>
      <p className="mt-4 rounded-2xl border-2 border-ink bg-lantern/30 p-3 text-sm">
        Ini mainnet: biaya gas dibayar dengan ETH sungguhan dan kontrak tidak bisa diubah setelah di-deploy. Cek ulang harga dan batas.
      </p>
      <button className="btn-lantern mt-5 w-full" onClick={deploy} disabled={isPending || receipt.isLoading}>
        {isPending ? "Konfirmasi di wallet…" : receipt.isLoading ? "Menunggu blok…" : "Deploy Lunetta"}
      </button>
      {formError && <Status tone="error">{formError}</Status>}
      {error && <Status tone="error">{friendlyError(error)}</Status>}
      {hash && !deployed && (
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
      { ...c, functionName: "phase" },
      { ...c, functionName: "totalMinted" },
      { ...c, functionName: "maxSupply" },
      { ...c, functionName: "revealed" },
      { ...c, functionName: "whitelistPrice" },
      { ...c, functionName: "publicPrice" },
      { ...c, functionName: "merkleRoot" },
      { ...c, functionName: "pendingOwner" },
    ],
    query: { refetchInterval: 8_000 },
  });
  const balance = useBalance({ address: contract, chainId: chainConfig.chainId, query: { refetchInterval: 8_000 } });

  const [owner, phase, minted, max, revealed, wlPrice, pubPrice, root] = (reads.data ?? []).map((r) => r.result);
  const isOwner = typeof owner === "string" && owner.toLowerCase() === me.toLowerCase();

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
  async function send(fn: () => Promise<Hash>) {
    reset();
    try {
      await fn();
    } catch {
      /* rendered from `error` */
    }
  }

  const [newWl, setNewWl] = useState("");
  const [newPub, setNewPub] = useState("");
  const [rootInput, setRootInput] = useState("");
  const [mintTo, setMintTo] = useState<string>(me);
  const [mintQty, setMintQty] = useState("1");

  useEffect(() => {
    fetch("/api/proof?address=0x0000000000000000000000000000000000000001")
      .then((r) => r.json())
      .then((d: { root?: string | null }) => d.root && setRootInput((v) => v || d.root!))
      .catch(() => {});
  }, []);

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
          <Stat label="Fase" value={typeof phase === "number" ? PHASES[phase] : "…"} />
          <Stat label="Terjual" value={minted !== undefined && max !== undefined ? `${String(minted)} / ${String(max)}` : "…"} />
          <Stat label="Harga WL / publik" value={typeof wlPrice === "bigint" && typeof pubPrice === "bigint" ? `${formatEther(wlPrice)} / ${formatEther(pubPrice)} ETH` : "…"} />
          <Stat label="Saldo kontrak" value={balance.data ? `${formatEther(balance.data.value)} ETH` : "…"} />
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
          {revealed === false && (
            <Action title="2. Sambungkan metadata" desc="Arahkan tokenURI ke website ini. Gambar tiap token tetap tersembunyi sampai token itu di-mint.">
              <button
                className="btn-lantern w-full"
                disabled={busy}
                onClick={() => send(() => writeContractAsync({ ...c, functionName: "reveal", args: [`${window.location.origin}/api/metadata/`] }))}
              >
                Sambungkan metadata
              </button>
            </Action>
          )}

          {revealed === true && phase !== 2 && (
            <Action title="3. Buka mint publik" desc="Setelah ini tombol Mint di website langsung berfungsi untuk semua orang.">
              <button
                className="btn-lantern w-full"
                disabled={busy}
                onClick={() => send(() => writeContractAsync({ ...c, functionName: "setPhase", args: [2] }))}
              >
                Buka mint publik
              </button>
            </Action>
          )}

          <Action title="Fase mint" desc="Publik = semua orang bisa mint. Pilih Tutup untuk menghentikan mint kapan saja.">
            <div className="grid grid-cols-3 gap-2">
              {PHASES.map((label, i) => (
                <button
                  key={label}
                  className={i === phase ? "btn-lantern !px-3" : "btn-paper !px-3"}
                  disabled={busy || i === phase}
                  onClick={() => send(() => writeContractAsync({ ...c, functionName: "setPhase", args: [i] }))}
                >
                  {label}
                </button>
              ))}
            </div>
          </Action>

          <Action title="Merkle root whitelist" desc="Isi otomatis dari daftar whitelist yang sudah di-build di website.">
            <input className="field font-mono text-xs" value={rootInput} onChange={(e) => setRootInput(e.target.value.trim())} placeholder="0x…" />
            <p className="mt-1 break-all text-xs text-ink/60">Saat ini di kontrak: {typeof root === "string" ? root : "…"}</p>
            <button
              className="btn-paper mt-3 w-full"
              disabled={busy || !isHex(rootInput) || rootInput.length !== 66}
              onClick={() => send(() => writeContractAsync({ ...c, functionName: "setMerkleRoot", args: [rootInput as `0x${string}`] }))}
            >
              Simpan root
            </button>
          </Action>

          <Action title="Ubah harga" desc="Dalam ETH. Berlaku untuk mint berikutnya.">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Whitelist" value={newWl} onChange={setNewWl} placeholder={typeof wlPrice === "bigint" ? formatEther(wlPrice) : ""} />
              <Field label="Publik" value={newPub} onChange={setNewPub} placeholder={typeof pubPrice === "bigint" ? formatEther(pubPrice) : ""} />
            </div>
            <button
              className="btn-paper mt-3 w-full"
              disabled={busy || !newWl || !newPub}
              onClick={() =>
                send(() => writeContractAsync({ ...c, functionName: "setPrices", args: [parseEther(newWl), parseEther(newPub)] }))
              }
            >
              Simpan harga
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

          <Action title="Tarik dana" desc="Kirim seluruh saldo kontrak ke wallet yang sedang terhubung.">
            <button
              className="btn-paper w-full"
              disabled={busy || !balance.data || balance.data.value === 0n}
              onClick={() => send(() => writeContractAsync({ ...c, functionName: "withdraw", args: [me] }))}
            >
              Tarik {balance.data ? formatEther(balance.data.value) : "0"} ETH
            </button>
          </Action>
        </>
      )}

      <div aria-live="polite">
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
