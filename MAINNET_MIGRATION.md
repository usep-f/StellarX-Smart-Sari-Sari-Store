# StellarX Sari-Sari Store Mainnet Migration Guide

This document outlines the step-by-step procedures, commands, and configurations required to transition the StellarX Sari-Sari Store & Point of Sale (POS) system from the Stellar Testnet to the Stellar Mainnet (Public Net).

---

## Architectural Decisions Summary (from Design Interview)

* **Network RPC Provider**: Dedicated third-party provider (e.g., QuickNode or Triton One) to avoid strict public rate limits and guarantee transaction reliability for POS checkouts.
* **Primary Payment Asset**: **Native XLM** for both transactions (sales payments) and gas/storage fees to simplify merchant and customer onboarding.
* **Key Management**: Developer's personal wallet using the Stellar CLI for compiling and deploying contracts.
* **State Rent (TTL)**: Self-sponsoring model. The merchant pays a small fee during the `register_store` call to cover the cost of contract storage rent.
* **User Authentication**: Hybrid Web2.5 Flow. Keep Firebase Auth (email/password) for user profile management and link the user's Freighter wallet for on-chain store registrations and payments.

---

## Migration Steps

### Phase 1: Smart Contract Compilation & Deployment

To deploy the Soroban smart contract to the Mainnet, follow these steps:

#### 1. Compile the Smart Contract
Ensure your contract is built in release mode and optimized for size. Run the following command from the repository root:
```powershell
stellar contract build
```
This builds the WASM binary and saves it to:
`./target/wasm32v1-none/release/sari_sari_registry.wasm`

#### 2. Configure Your Mainnet Wallet in Stellar CLI
Add your personal developer wallet's secret key to the Stellar CLI. Replace `SD...` with your mainnet secret key:
```powershell
stellar keys add deployer --secret-key SDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

#### 3. Fund Your Wallet
Ensure this wallet is funded with a minimum of **50–100 XLM** on the public network to cover gas and ledger state rent fees.

#### 4. Deploy the Contract to Mainnet
Deploy the contract to the public network by running:
```powershell
stellar contract deploy `
  --wasm .\target\wasm32v1-none\release\sari_sari_registry.wasm `
  --source deployer `
  --network public
```
Save the returned contract ID (it will start with `C...` and look like `CDZEW...`). This will be your `NEXT_PUBLIC_REGISTRY_CONTRACT_ID`.

---

### Phase 2: RPC & Network Provider Infrastructure

Stellar's public RPC node (`https://soroban-rpc.mainnet.stellar.org`) is heavily rate-limited and unsuitable for customer checkouts in a retail environment.

1. **Sign Up for an RPC Provider**: Create an account on [QuickNode](https://www.quicknode.com/) or [Triton One](https://triton.one/).
2. **Obtain Mainnet HTTPS RPC Endpoint**: Set up a Stellar/Soroban Mainnet node and copy the HTTPS endpoint (e.g., `https://xxxxxx.stellar-mainnet.quiknode.pro/`).
3. **Horizon API URL**: Use the official public Horizon endpoint for querying account balances: `https://horizon.stellar.org`.

---

### Phase 3: Frontend Code Adjustments

#### 1. Update Environment Variables (`web/.env.production`)
Create or update your production environment variables to point to Mainnet resources:
```ini
NEXT_PUBLIC_FIREBASE_API_KEY=your-production-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-production-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-production-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-production-app.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Mainnet contract and RPC configuration
NEXT_PUBLIC_REGISTRY_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_SOROBAN_RPC=https://your-dedicated-rpc-provider.com
NEXT_PUBLIC_HORIZON_URL=https://horizon.stellar.org
```

#### 2. Switch SDK Network Constants
Update the network configuration in [stellar.ts](file:///c:/Users/venre/Desktop/StellarX-Workshop-Jun-2026/web/src/lib/stellar.ts#L3-L6):
```diff
- export const NETWORK_PASSPHRASE = Networks.TESTNET;
+ export const NETWORK_PASSPHRASE = Networks.PUBLIC;
```

#### 3. Remove Faucet (Friendbot) Code
Since Friendbot is only for Testnet, remove references to it in your UI:
* Remove the **"Get 10,000 Testnet XLM"** button from [MerchantPage](file:///c:/Users/venre/Desktop/StellarX-Workshop-Jun-2026/web/src/app/merchant/page.tsx#L475-L496).
* Disable the `fundTestnetAccount` import and function call in both the frontend components and [stellar.ts](file:///c:/Users/venre/Desktop/StellarX-Workshop-Jun-2026/web/src/lib/stellar.ts#L20-L29).

---

### Phase 4: Production User Onboarding

When launching on Mainnet, merchants and customers need to transition to real funds:

1. **Freighter Wallet Configuration**:
   * Users must switch their Freighter browser extension from **Test Net** to **Public Net**.
2. **Account Activation**:
   * In Stellar, a wallet address is not active until it receives a minimum of **1 XLM** (this is a network-level anti-spam reserve requirement). Users must fund their wallets via exchange withdrawals or local cash-in anchors before they can interact with the app.
3. **Transaction Budgets**:
   * Remind merchants that registering a store on the registry writes data permanently to the blockchain ledger and will require a small amount of real XLM (less than `0.1 XLM`) for gas and storage rent.
