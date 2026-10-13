# Pre-mainnet security checklist

Tick every box before deploying to mainnet. Anything unticked is a launch blocker.

## Smart contract

- [ ] `forge test` passes on CI, including fuzz tests (`runs = 512`; bump to 10k for a final run: `FOUNDRY_FUZZ_RUNS=10000 forge test`).
- [ ] `forge coverage` reviewed — every branch in `Lunetta.sol` is exercised.
- [ ] Static analysis: `slither .` (and optionally Aderyn) run with all findings triaged.
- [ ] **External audit** by a reputable firm or experienced independent reviewer, with the report published. Fix → re-review loop completed.
- [ ] Compiler pinned (`0.8.26`) and dependency versions pinned (ERC721A 4.3.0, OZ 5.1.0) — same as audited.
- [ ] Deployment parameters double-checked in wei: prices, limits, max supply, royalty bps (≤ 1000).
- [ ] Testnet rehearsal done end-to-end: WL mint, public mint, limits, sold-out, reveal, freeze, withdraw.
- [ ] Contract verified on the block explorer; source matches the audited commit.

## Keys and ownership

- [ ] Deployer key is a fresh wallet used only for deployment, stored in Foundry's encrypted keystore (`--account`), never in `.env` or Git.
- [ ] Owner is a **Safe multisig** (≥ 2-of-3), signers on hardware wallets, held by different people.
- [ ] `acceptOwnership()` executed from the Safe; `owner()` verified on the explorer.
- [ ] Royalty receiver and withdraw destination are the Safe (or a treasury Safe).
- [ ] Deployer wallet emptied after deploy.

## Whitelist API and website

- [ ] Upstash Redis configured in production (`UPSTASH_REDIS_REST_*`) — the in-memory fallback is not shared across serverless instances.
- [ ] Vercel Firewall / bot protection enabled on `/api/whitelist` for extra protection against sybil floods.
- [ ] `DATABASE_URL` uses TLS and a least-privilege DB user (insert/select on `whitelist_entries` only).
- [ ] `IP_HASH_SALT` set to a long random value; raw IPs are never stored.
- [ ] `NEXT_PUBLIC_SITE_URL` equals the production domain (signature messages are bound to it).
- [ ] WL snapshot reviewed for obvious bot clusters (same `ip_hash`, sequential creation times) before building the tree.
- [ ] `data/whitelist-tree.json` deployed **before** `setMerkleRoot` is called; mint page shows no "being updated" warning.
- [ ] Dedicated RPC endpoint with rate limits configured (public RPCs throttle on mint day).
- [ ] Security headers present (check with securityheaders.com); site served over HTTPS only.
- [ ] Dependencies audited: `npm audit --omit=dev` reviewed; lockfile committed.
- [ ] No secrets in `NEXT_PUBLIC_*` variables.

## Operations and community safety

- [ ] Contract address announced only via official channels; pinned in Discord and on X.
- [ ] Discord hardened: no DMs from server members, verification bot, admins with 2FA, no "support ticket" links to external sites.
- [ ] Domain registrar and Vercel accounts protected with hardware-key 2FA; DNS lock enabled.
- [ ] Incident plan written: who can sign `setPhase(0)` on the Safe within minutes, and how you'll communicate.
- [ ] Metadata and images pinned on at least two IPFS providers before reveal.
- [ ] Legal review done for your jurisdiction (consumer, securities and tax rules for NFT sales; terms of service and privacy policy for the whitelist data).
