# Lunetta launch guide (testnet → mainnet)

## Fastest path: Robinhood Chain from your phone (no terminal)

The site ships with an owner panel at **`/admin`** that deploys and manages the contract straight from your wallet. Default network: **Robinhood Chain mainnet** (chain ID 4663, RPC `https://rpc.mainnet.chain.robinhood.com`, explorer `https://robinhoodchain.blockscout.com`). Use chain ID 46630 (`NEXT_PUBLIC_CHAIN_ID`) to rehearse on Robinhood Chain Testnet first.

**Payment model:** mints are paid in the project's ERC-20 token, not ETH (default price 1,000,000 tokens per NFT). Every payment is transferred from the buyer straight to the burn address `0x000000000000000000000000000000000000dEaD` inside the mint transaction, so the contract and the owner never hold mint proceeds. Buyers still need a little ETH for gas, and approve the token once before minting (the mint page does both steps).

1. Open `https://<your-site>/admin` in your wallet's in-app browser (MetaMask, Rainbow, Coinbase Wallet). Have a little ETH on Robinhood Chain for gas.
2. Connect, check prices (in tokens) and limits, tap **Deploy Lunetta**, confirm in the wallet. The panel shows the contract address and the constructor arguments. Prices assume an 18-decimal token; adjust them later from the panel if your token differs.
3. **Pasang token pembayaran** (`setPaymentToken`): paste the ERC-20 address once the token is live. Minting can't start before this (unless the price is 0). When you're sure it's right, tap **Kunci token** (`lockPaymentToken`) so holders know it can never be swapped.
4. Tap **Sambungkan metadata** (reveal). This points `tokenURI` at `/api/metadata/`; each token's art stays hidden until that token is minted, so rarities can't be sniped.
5. Make the public site use the contract: commit the address into `web/data/deployment.json` (or set `NEXT_PUBLIC_CONTRACT_ADDRESS` in Vercel) and redeploy.
6. Verify on Blockscout: *Verify & Publish → Solidity (Standard JSON input)*, compiler `v0.8.26+commit.8a97fa7a`, upload `contracts/verification/Lunetta.standard-input.json`, contract `src/Lunetta.sol:Lunetta`, paste the constructor arguments shown in the panel.
7. When ready: **Buka mint publik** (`setMintOpen(true)`). There is no whitelist: everyone mints at the same price and limit. Do one test mint yourself and check the burn on the explorer (`TokensBurned` event, balance of `0x…dEaD`).
8. Transfer ownership to a multisig once the mint is running smoothly (see below).

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
6. Create accounts: Upstash Redis, Reown (WalletConnect project ID), Pinata or Filebase, Vercel.

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
    --constructor-args $(cast abi-encode "constructor(string,string,uint256,uint256,uint256,string,address,uint96,address)" \
      "Lunetta" "LUNA" $MAX_SUPPLY $PRICE_UNITS $WALLET_LIMIT "$UNREVEALED_URI" $ROYALTY_RECEIVER $ROYALTY_BPS <DEPLOYER_ADDRESS>)
  ```
- If `INITIAL_OWNER` was a Safe, accept ownership from the Safe (Transaction Builder → `acceptOwnership()`).

**Website on testnet**

1. In Vercel, import the repo, set **Root Directory = `web`**, add all env vars from `web/.env.example` with `NEXT_PUBLIC_CHAIN_ID=84532` and the new contract address.
2. Deploy and open the preview.

**Token → mint → reveal**

```bash
cd contracts && export LUNETTA_ADDRESS=<address>
forge script script/Admin.s.sol:SetPaymentToken --sig "run(address)" <TOKEN> --rpc-url <rpc> --account deployer --broadcast
forge script script/Admin.s.sol:SetMintOpen --sig "run(bool)" true --rpc-url <rpc> --account deployer --broadcast
```

Test on the site: approve + mint works; tokens land at `0x…dEaD`; exceeding the wallet limit shows the right message; a wallet without enough tokens is told so; wrong network prompts a switch.

```bash
forge script script/Admin.s.sol:Reveal --sig "run(string)" "ipfs://<METADATA_CID>/" ...
```

Check `/gallery` shows revealed images and the collection on a testnet marketplace.

## 3. Pre-mainnet gate

Complete **every item** in [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md). In particular: external audit (or at minimum an independent review), multisig ownership, and production rate limiting.

## 4. Mainnet (Base)

1. Final parameters in `contracts/.env`: `MAX_SUPPLY`, `PRICE_UNITS` in token units (double-check with `cast to-wei 1000000`), `WALLET_LIMIT`, `PAYMENT_TOKEN`, `ROYALTY_RECEIVER` and `INITIAL_OWNER` = Safe address, `UNREVEALED_URI`.
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
6. Vercel **production** env: chain ID, mainnet RPC, contract address. Redeploy.
7. Safe → `lockPaymentToken()` once the token address is confirmed.
8. Announce the contract address **only** from your official X/Discord and the site. Pin it.

## 5. Mint day

1. Safe → `setMintOpen(true)` at the announced time. Watch the site, the explorer and Discord.
2. If anything looks wrong: Safe → `setMintOpen(false)` pauses minting immediately.
3. Sold out or ended → `setMintOpen(false)`.

## 6. After the mint

1. Upload final metadata folder, Safe → `reveal("ipfs://<CID>/")`.
2. Refresh metadata on marketplaces; spot-check 10+ tokens.
3. Pin with a second provider. Then Safe → `freezeMetadata()` (irreversible).
4. Set royalty enforcement/collection details on marketplaces (name, description, banner, links).

## Rollback / incident notes

- Minting can be paused instantly with `setMintOpen(false)`; no other emergency functions exist by design.
- A wrong payment token can be replaced with `setPaymentToken` until `lockPaymentToken()` is called.
- `maxSupply` cannot change after deploy — get it right on testnet.
- Never share or paste a private key into a website, bot or support chat.
