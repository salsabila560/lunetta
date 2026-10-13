# Lunetta launch guide (testnet → mainnet)

## Fastest path: Robinhood Chain from your phone (no terminal)

The site ships with an owner panel at **`/admin`** that deploys and manages the contract straight from your wallet. Default network: **Robinhood Chain mainnet** (chain ID 4663, RPC `https://rpc.mainnet.chain.robinhood.com`, explorer `https://robinhoodchain.blockscout.com`). Use chain ID 46630 (`NEXT_PUBLIC_CHAIN_ID`) to rehearse on Robinhood Chain Testnet first.

1. Open `https://<your-site>/admin` in your wallet's in-app browser (MetaMask, Rainbow, Coinbase Wallet). Have a little ETH on Robinhood Chain for gas.
2. Connect, check prices/limits, tap **Deploy Lunetta**, confirm in the wallet. The panel shows the contract address and the constructor arguments.
3. Tap **Sambungkan metadata** (reveal). This points `tokenURI` at `/api/metadata/`; each token's art stays hidden until that token is minted, so rarities can't be sniped.
4. Make the public site use the contract: commit the address into `web/data/deployment.json` (or set `NEXT_PUBLIC_CONTRACT_ADDRESS` in Vercel) and redeploy.
5. Verify on Blockscout: *Verify & Publish → Solidity (Standard JSON input)*, compiler `v0.8.26+commit.8a97fa7a`, upload `contracts/verification/Lunetta.standard-input.json`, contract `src/Lunetta.sol:Lunetta`, paste the constructor arguments shown in the panel.
6. When ready: **Fase → Publik** (or Whitelist after setting the Merkle root). Withdraw from the same panel.
7. Transfer ownership to a multisig once the mint is running smoothly (see below).

The rest of this guide covers the Foundry/CLI route.


Follow the steps in order. Don't skip the testnet rehearsal: run the *entire* flow there with real wallets, including reveal and withdraw.

Commands assume Base. For Ethereum, swap `base_sepolia`/`base` for your RPC aliases and use chain IDs `11155111`/`1`.

---

## 0. One-time setup

1. Install Foundry: `curl -L https://foundry.paradigm.xyz | bash && foundryup`
2. Create a **dedicated deployer key** and store it encrypted in Foundry's keystore (never in a `.env` file):
   ```bash
   cast wallet import deployer --interactive
   ```
3. Fund the deployer with a little ETH on Base Sepolia (faucet) and later on Base.
4. Get an **Etherscan API key** (the Etherscan V2 key also verifies on Basescan).
5. Create a **Safe multisig** on Base at app.safe.global (recommended: 2-of-3 or 3-of-5, signers on separate hardware wallets). This becomes the owner and royalty receiver.
6. Create accounts: Postgres (Neon/Supabase), Upstash Redis, Reown (WalletConnect project ID), Pinata or Filebase, Vercel.

```bash
cd contracts
cp .env.example .env    # fill in RPC URLs, ETHERSCAN_API_KEY, deploy parameters
source .env
```

## 1. Prepare metadata (before deploy)

1. Upload the hidden image + `hidden.json` to IPFS → set `UNREVEALED_URI=ipfs://<cid>/hidden.json`.
2. Keep final art and `metadata/` private until reveal.

## 2. Testnet rehearsal (Base Sepolia)

```bash
# Deploy + verify in one step
forge script script/Deploy.s.sol:Deploy \
  --rpc-url base_sepolia --account deployer --broadcast --verify -vvvv
```

- Note the address printed (`Lunetta deployed at:`). The contract page on sepolia.basescan.org should show a green "verified" tick.
- If verification fails, retry it on its own:
  ```bash
  forge verify-contract <ADDRESS> src/Lunetta.sol:Lunetta --chain base-sepolia --watch \
    --constructor-args $(cast abi-encode "constructor(string,string,uint256,uint256,uint256,uint256,uint256,string,address,uint96,address)" \
      "Lunetta" "LUNA" $MAX_SUPPLY $WL_PRICE_WEI $PUBLIC_PRICE_WEI $WL_LIMIT $PUBLIC_LIMIT "$UNREVEALED_URI" $ROYALTY_RECEIVER $ROYALTY_BPS <DEPLOYER_ADDRESS>)
  ```
- If `INITIAL_OWNER` was a Safe, accept ownership from the Safe (Transaction Builder → `acceptOwnership()`).

**Website on testnet**

1. In Vercel, import the repo, set **Root Directory = `web`**, add all env vars from `web/.env.example` with `NEXT_PUBLIC_CHAIN_ID=84532` and the new contract address.
2. Run `npm run db:migrate` once against the production database (locally, with `DATABASE_URL` set).
3. Deploy. Visit the preview, join the whitelist from 3+ test wallets (including a smart wallet like Coinbase Smart Wallet).

**Whitelist → mint → reveal**

```bash
cd web && npm run merkle                     # prints the root
git add data/whitelist-tree.json && git commit -m "WL snapshot" && git push   # Vercel redeploys
cd ../contracts && export LUNETTA_ADDRESS=<address>
forge script script/Admin.s.sol:SetMerkleRoot --sig "run(bytes32)" <ROOT> --rpc-url base_sepolia --account deployer --broadcast
forge script script/Admin.s.sol:SetPhase --sig "run(uint8)" 1 --rpc-url base_sepolia --account deployer --broadcast   # whitelist
```

Test on the site: WL wallet mints; non-WL wallet sees "not on the whitelist"; exceeding the limit shows the right message; wrong network prompts a switch.

```bash
forge script script/Admin.s.sol:SetPhase --sig "run(uint8)" 2 ...   # public
forge script script/Admin.s.sol:Reveal --sig "run(string)" "ipfs://<METADATA_CID>/" ...
```

Check `/gallery` shows revealed images, check the collection on a testnet marketplace, then withdraw to the Safe and confirm funds arrive.

## 3. Pre-mainnet gate

Complete **every item** in [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md). In particular: external audit (or at minimum an independent review), multisig ownership, and production rate limiting.

## 4. Mainnet (Base)

1. Final parameters in `contracts/.env`: `MAX_SUPPLY`, prices **in wei** (double-check with `cast to-wei 0.004`), limits, `ROYALTY_RECEIVER` and `INITIAL_OWNER` = Safe address, `UNREVEALED_URI`.
2. Dry run (no broadcast) and read the output carefully:
   ```bash
   forge script script/Deploy.s.sol:Deploy --rpc-url base --account deployer -vvvv
   ```
3. Deploy + verify:
   ```bash
   forge script script/Deploy.s.sol:Deploy --rpc-url base --account deployer --broadcast --verify -vvvv
   ```
4. From the Safe: `acceptOwnership()`. Confirm `owner()` on Basescan is the Safe.
5. Optional team reserve: Safe → `ownerMint(to, qty)` in batches of ≤ 30.
6. Vercel **production** env: `NEXT_PUBLIC_CHAIN_ID=8453`, mainnet RPC, contract address, `WHITELIST_OPEN=false` once registration ends. Redeploy.
7. Snapshot: `npm run merkle`, commit, wait for the deploy to finish, then Safe → `setMerkleRoot(root)`.
8. Announce the contract address **only** from your official X/Discord and the site. Pin it.

## 5. Mint day

1. Safe → `setPhase(1)` (Whitelist) at the announced time. Watch the site, Basescan and Discord.
2. Safe → `setPhase(2)` (Public) when the WL window ends.
3. If anything looks wrong: Safe → `setPhase(0)` pauses minting immediately.
4. Sold out or ended → `setPhase(0)`.

## 6. After the mint

1. Upload final metadata folder, Safe → `reveal("ipfs://<CID>/")`.
2. Refresh metadata on marketplaces; spot-check 10+ tokens.
3. Pin with a second provider. Then Safe → `freezeMetadata()` (irreversible).
4. Safe → `withdraw(<treasury>)`.
5. Set royalty enforcement/collection details on marketplaces (name, description, banner, links).

## Rollback / incident notes

- Minting can be paused instantly with `setPhase(0)`; no other emergency functions exist by design.
- A wrong Merkle root can be replaced with `setMerkleRoot` at any time.
- `maxSupply` cannot change after deploy — get it right on testnet.
- Never share or paste a private key into a website, bot or support chat.
