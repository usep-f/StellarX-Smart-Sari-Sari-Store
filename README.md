# Sari-Stellar POS & Map

A decentralized Point-of-Sale (PoS) system and discovery map for local sari-sari stores in the Philippines. It operates entirely on the **Stellar Testnet** using native XLM.

It covers:
- **Soroban Smart Contract**: An on-chain store registry allowing owners to register coordinates and names.
- **Fullstack POS Checkout**: Generates custom payment QR codes and polls the Horizon blockchain for real-time customer settlement.

```
.
├── web/                           # Next.js 15 + TypeScript + Tailwind frontend
├── contracts/sari-sari-registry/  # Rust Soroban store registry contract
├── scripts/                       # deploy-registry.ps1 (Windows deployment)
├── Cargo.toml                     # Rust workspace
└── CLAUDE.md                      # stack notes + Stellar gotchas
```

## Prerequisites

From the [workshop setup checklist](https://stellar-pup-qc-may-2026-checklist.vercel.app/):

- **Node.js 20+** and **npm** — for the frontend.
- **Freighter** browser extension — create a wallet, switch it to **Test Net**.
- For the contract track: **Rust**, the `wasm32v1-none` target, and the **Stellar CLI**.

You can run the **payments demo with just Node + Freighter** — Rust/CLI are only
needed to deploy the Soroban contract.

### Install the contract toolchain (Windows)

Install Rust and the Stellar CLI:

```powershell
winget install --id Rustlang.Rustup -e --accept-source-agreements --accept-package-agreements
winget install --id Stellar.StellarCLI -e --accept-source-agreements --accept-package-agreements
```

Then **open a new terminal** (so `cargo`/`stellar` land on PATH) and give Rust a
working linker — pick one:

**Easiest — GNU toolchain** (no admin, no large download):

```powershell
rustup default stable-x86_64-pc-windows-gnu
rustup target add wasm32v1-none
```

**Or MSVC** (matches Stellar's docs): install the **Visual C++ Build Tools** (the
"Desktop development with C++" workload), then:

```powershell
rustup target add wasm32v1-none
```

> If `cargo` fails with *"linker `link.exe` not found"*, you skipped the step
> above — use the GNU toolchain or install the Build Tools.

On macOS/Linux: install Rust from <https://rustup.rs>, run
`rustup target add wasm32v1-none`, and install the Stellar CLI
(`brew install stellar-cli`).

## 1. Run the frontend (the part that demos immediately)

```powershell
cd web
npm install        # already run if you scaffolded via this repo
npm run dev
```

Open <http://localhost:3000>, then:

1. **Connect Freighter** (approve in the extension; make sure it's on Test Net).
2. **Fund with Friendbot** — your XLM balance jumps to ~10,000.
3. **Send a payment** to another *existing, funded* testnet account
   (create one at <https://laboratory.stellar.org/#account-creator?network=test>).
4. Watch the status go Building → Signing → Submitting → Confirming → Success,
   then open the **Stellar Expert** link to see it on-chain.

`web/.env.local` is pre-filled with testnet config including the pre-deployed contract address.

## 2. Build, test & deploy the Soroban contract

```powershell
# from the repo root
cargo test                 # runs the contract unit tests (no network needed)

# deploy to testnet + auto-wire the contract ID into web/.env.local
.\scripts\deploy-registry.ps1
```

The deploy script will: create+fund a testnet identity (if needed), run
`stellar contract build`, deploy, and write the new `NEXT_PUBLIC_REGISTRY_CONTRACT_ID` into `web/.env.local`. **Restart the frontend** using `.\dev.ps1` to pick up any new contract IDs.

### The contract (`contracts/sari-sari-registry/src/lib.rs`)

| Function | Purpose |
|---|---|
| `register_store(owner: Address, name: String, lat: i32, lng: i32)` | Register a new store coordinates & name. |
| `deregister_store(owner: Address)` | Deletes a store from the registry. |
| `get_all_stores() -> Vec<Store>` | Read-only method to fetch all registered stores. |

## 3. Customizing & Extensions

This is your custom dApp build. You can expand it with:
- Store ratings and reviews.
- Product list on-chain storage or decentralised storage (IPFS).
- USDC support for payments (see CLAUDE.md for USDC SAC details).
- Multi-signature shared store wallets.

## Troubleshooting

- **Freighter "not detected"** — install it, reload the page, and confirm it's unlocked.
- **Payment fails `op_no_destination`** — fund the destination account first.
- **`tx_bad_auth`** — wrong network passphrase; this app uses `Networks.TESTNET`.
- **Map rendering only single tile** — resolved by automatically calling `map.invalidateSize()` on render.

See **CLAUDE.md** for the full list of Stellar gotchas.
