# Lunetta

*Keep watch over the drifting isles.*

Lunetta is a hand-drawn fantasy NFT game. In the world of **Halcyra**, islands float only while the moon remembers them; Lunettas — winged moon-cats born from fallen moonlight — keep lanterns lit so the isles don't sink into the Cloudsea. Each NFT is a playable character whose traits become in-game abilities.

This repository contains everything needed to launch the collection:

| Folder | What it is |
| --- | --- |
| `contracts/` | `Lunetta.sol` (ERC-721A), Foundry test suite, deploy and admin scripts |
| `web/` | Next.js 15 (App Router) site: landing, `/whitelist`, `/mint`, `/gallery`, APIs |
| `docs/` | Mainnet launch guide and pre-mainnet security checklist |
| `.github/workflows/ci.yml` | Runs `forge test` and `next build` on every push |

Default target chain is **Robinhood Chain mainnet** (chain ID 4663; testnet 46630). Base and Ethereum are also supported by changing `NEXT_PUBLIC_CHAIN_ID`.

**Collection:** 1,000 unique Lunettas generated from 8 traits (`web/data/collection.json`, reproducible with `python3 web/scripts/generate-collection.py`), including 5 Moonborn 1/1s. Art is rendered on demand as SVG by `web/src/lib/art/render.ts` and served from `/api/image/<id>`; metadata from `/api/metadata/<id>.json`. Both stay hidden until a token is minted. **Owner panel:** `/admin` deploys and manages the contract from a wallet.

---

## Contract at a glance

`contracts/src/Lunetta.sol`

- **ERC-721A** + `ERC721AQueryable` (cheap batch mints, `tokensOfOwner` for the gallery). Token IDs start at 1.
- **Phases:** `Closed → Whitelist → Public`, set by the owner.
- **Paid in the project ERC-20, burned on mint**: `paymentToken` (set/lockable by the owner) is pulled from the buyer straight to `0x…dEaD` in the mint transaction via `SafeERC20`; `totalBurned` tracks the running total. No ETH is accepted for mints.
- **Per-phase pricing** (`whitelistPrice`, `publicPrice`, in token units) and **per-wallet limits** tracked separately per phase.
- **Merkle whitelist** in OpenZeppelin `StandardMerkleTree` format (double-hashed leaves; second-preimage safe).
- **Max supply** fixed at deploy (`immutable`), enforced on every mint path including `ownerMint`.
- **Delayed reveal:** every token returns `UNREVEALED_URI` until `reveal("ipfs://CID/")`; then `baseURI + id + ".json"`. `freezeMetadata()` locks it permanently.
- **ERC-2981 royalties** (default 5%, owner-adjustable).
- **Ownable2Step** (safe hand-over to a Safe multisig), `ReentrancyGuard`, `withdraw(to)`.
- **`mintState(address)`** view returns everything the mint page needs in one call.
- Exact-payment checks (no accidental overpay), custom errors for clear frontend messages.

## Quick start (local)

**Requirements:** Node 20.11+, [Foundry](https://book.getfoundry.sh/getting-started/installation), a Postgres database (Neon free tier works), optional Upstash Redis.

```bash
# 1. Contracts
cd contracts
./install-deps.sh          # pinned: forge-std 1.9.4, ERC721A 4.3.0, OpenZeppelin 5.1.0
forge build --sizes
forge test -vvv            # full suite incl. fuzz tests

# 2. Website
cd ../web
cp .env.example .env       # fill in values (see table below)
npm install
npm run db:migrate         # creates the whitelist table
npm run dev                # http://localhost:3000
```

To try the full mint flow locally, run `anvil` in another terminal, deploy to it with `forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key <anvil key>`, then point `NEXT_PUBLIC_RPC_URL` at it. (Anvil uses chain ID 31337 — for the UI, testing on Base Sepolia is simpler.)

## Environment variables (`web/.env`)

| Variable | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_CHAIN_ID` | public | `84532` Base Sepolia, `8453` Base, `11155111` Sepolia, `1` Ethereum |
| `NEXT_PUBLIC_RPC_URL` | public | Use a dedicated RPC (Alchemy / QuickNode / Coinbase CDP) in production |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | public | Leave as zero address until deployed — the site shows "opens soon" |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | public | From cloud.reown.com, required for WalletConnect wallets |
| `NEXT_PUBLIC_SITE_URL` | public | Canonical URL; also the domain inside whitelist signatures |
| `NEXT_PUBLIC_IPFS_GATEWAY` | public | e.g. your Pinata dedicated gateway `https://xyz.mypinata.cloud/ipfs/` |
| `NEXT_PUBLIC_X_URL`, `NEXT_PUBLIC_DISCORD_URL` | public | Footer social links |
| `NEXT_PUBLIC_PLAY_URL` | public | Empty → "Play" shows a *Soon* badge |
| `DATABASE_URL` | server | Pooled Postgres URL with `sslmode=require` |
| `WHITELIST_OPEN` | server | `true` / `false` |
| `WHITELIST_CLOSES_AT` | server | Optional ISO timestamp for automatic close |
| `WHITELIST_MAX_SPOTS` | server | Optional cap, `0` = unlimited |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | server | Rate limiting (5 submissions / 10 min / IP). **Required in production** |
| `IP_HASH_SALT` | server | Random string; IPs are stored only as salted hashes |

## How the whitelist works

1. User connects a wallet on `/whitelist` and signs a plain-text message (free, no transaction). The message includes the site domain, wallet, chain ID and a timestamp.
2. `POST /api/whitelist` rate-limits by IP, validates input with zod, checks the message is < 10 minutes old and for this domain/chain, verifies the signature with `viem` (works for normal wallets and smart wallets via ERC-1271/6492), then inserts into Postgres (one row per wallet).
3. When registration closes, run `npm run merkle` → writes `data/whitelist-tree.json` and prints the root.
4. Commit + redeploy the site (so `/api/proof` serves the new tree), **then** call `setMerkleRoot(root)` on the contract.
5. On `/mint`, the site fetches the wallet's proof from `/api/proof` and passes it to `whitelistMint`. If the site's root and the on-chain root ever differ, the mint page shows a warning instead of failing silently.

## Metadata and IPFS

1. Export final images as `1.png … N.png` into one folder and upload it to IPFS (Pinata, Filebase or `ipfs add -r`). Note the folder CID.
2. Fill `web/data/traits.csv` (see `traits.example.csv`), then run `IMAGES_CID=<cid> npm run metadata`.
3. Upload `web/metadata/hidden.json` (and its image) first — that URI goes into `UNREVEALED_URI` at deploy.
4. After the mint, upload the `metadata/` folder and call `reveal("ipfs://<metadata CID>/")`. Once verified on marketplaces, call `freezeMetadata()`.

Pin everything with at least two providers; IPFS content disappears if nobody pins it.

## Deploying

See **[docs/LAUNCH_GUIDE.md](docs/LAUNCH_GUIDE.md)** for the full testnet → mainnet runbook and **[docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md)** before going live.

## Art and IP

All characters, lore, copy, illustrations (`web/src/components/illustrations.tsx`) and the visual identity in this repo were created for Lunetta and do not reuse any other project's assets. The illustrations are vector placeholders in the final art direction (ink line, off-register risograph fills, parchment palette); commission or draw the final collection art yourself and keep written agreements that assign you the rights. Fonts (Fraunces, Figtree, JetBrains Mono) are open-source under the SIL Open Font License.

## Scripts reference

| Where | Command | Purpose |
| --- | --- | --- |
| contracts | `forge test -vvv` | Run the test suite |
| contracts | `forge script script/Deploy.s.sol:Deploy …` | Deploy (+ optional verify) |
| contracts | `forge script script/Admin.s.sol:SetPhase …` | Owner actions on testnet |
| web | `npm run db:migrate` | Create DB tables |
| web | `npm run merkle` | Snapshot whitelist → Merkle tree + root |
| web | `npm run metadata` | Generate token metadata JSON |
| web | `npm run abi` | Re-sync ABI after changing the contract |
