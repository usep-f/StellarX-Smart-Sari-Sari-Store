# Deregistering Stores & Wiping User Data via CLI

This guide provides instructions on how to deregister stores and wipe user data on the `sari-sari-registry` smart contract using the Stellar CLI and Firebase CLI. 

Because the contract enforces strict ownership controls (`owner.require_auth()`), there is no admin backdoor to delete another user's data. Therefore, there are two primary methods depending on your goal:

1. **Method 1: Clean Slate (Contract Redeployment)** – Best for development and testing to reset all stores and off-chain data at once.
2. **Method 2: Individual Deregistration (Signature Required)** – For removing specific stores on a live network when you have access to the owner's credentials.

---

## Method 1: Clean Slate (Contract Redeployment)

During development and testing on the Testnet, the fastest and most reliable way to "wipe all stores" on the smart contract is to redeploy the contract. Deploying a new contract instance generates a brand new Contract ID, which starts with a completely clean and empty persistent storage state.

### Step 1: Build the Contract
Compile the Rust contract to WebAssembly (`.wasm`):
```powershell
stellar contract build
```

### Step 2: Deploy to Testnet
Deploy the compiled WASM to the Stellar Testnet. You can use your custom identity (e.g., `workshop` or `default`):
```powershell
stellar contract deploy `
  --wasm target\wasm32v1-none\release\sari_sari_registry.wasm `
  --source-account workshop `
  --network testnet
```
*Alternatively, you can run the provided PowerShell helper script in the project root:*
```powershell
.\scripts\deploy-registry.ps1 workshop
```
This script builds the contract, deploys it, and automatically updates the contract ID in your Next.js environment file.

### Step 3: Update the Frontend Environment
If you deployed manually, update the contract ID in your environment configuration file:
1. Open [web/.env.local](file:///c:/Users/venre/Desktop/StellarX-Workshop-Jun-2026/web/.env.local).
2. Find the key `NEXT_PUBLIC_REGISTRY_CONTRACT_ID`.
3. Replace the old contract ID with the new one:
   ```env
   NEXT_PUBLIC_REGISTRY_CONTRACT_ID=C...
   ```
4. Restart your Next.js development server to apply the changes:
   ```bash
   cd web
   npm run dev
   ```

### Step 4: Wipe Off-Chain Firestore Data
Since the new contract instance has no stores registered, the off-chain database (Firestore) will contain stale data. You must clear the Firestore collections to match the fresh blockchain state:
```bash
# Log in to your Firebase account (if not already logged in)
firebase login

# Delete the collections holding user profiles, stores, and transaction history
firebase firestore:delete stores --recursive --yes --project saristellarx
firebase firestore:delete users --recursive --yes --project saristellarx
firebase firestore:delete purchases --recursive --yes --project saristellarx
```

---

## Method 2: Individual Deregistration via CLI

If you want to keep the contract ID but deregister specific stores from the active registry, you can call the contract's `deregister_store` method directly via CLI. 

> [!WARNING]
> Because `deregister_store` calls `owner.require_auth()` inside the smart contract, you **must** sign the transaction with the private key or identity corresponding to the store owner's address. You cannot deregister someone else's store.

### Step 1: Retrieve Registered Store Owners
To find the addresses of registered store owners, you can:
1. View documents in the `stores` collection in the Firebase Console.
2. Or query the smart contract's registration events using the Stellar CLI:
   ```bash
   stellar contract event list `
     --id CDFDBCIKFPE7QCH6RQG5IXB4UWGLPF7U2W2YKIHYJQZLWSXQ7T74BJCJ `
     --start-ledger 4321000 `
     --network testnet
   ```

### Step 2: Invoke the Deregistration Method
Invoke the contract's `deregister_store` method. Pass the owner's address as the `--owner` argument, and sign using the owner's CLI identity key:
```bash
stellar contract invoke `
  --id CDFDBCIKFPE7QCH6RQG5IXB4UWGLPF7U2W2YKIHYJQZLWSXQ7T74BJCJ `
  --source-account <owner-identity-name> `
  --network testnet `
  -- `
  deregister_store `
  --owner <owner-wallet-address>
```
*Example:*
```bash
stellar contract invoke `
  --id CDFDBCIKFPE7QCH6RQG5IXB4UWGLPF7U2W2YKIHYJQZLWSXQ7T74BJCJ `
  --source-account merchant_joy `
  --network testnet `
  -- `
  deregister_store `
  --owner GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
```

### Step 3: Verify & Sync Off-Chain Data
The on-chain deregistration emits a `StoreDeregistered` event. The Cloud Function indexer will automatically pick this up during its next run (runs every 1 minute) and clean up Firestore by:
- Clearing the `linkedWallet` field on the merchant's profile in the `users` collection.
- Recursively deleting the store's document and subcollections (products, receipts) in `stores/<owner>`.

To trigger the indexer sync on-demand without waiting:
```bash
curl -X POST https://asia-southeast1-saristellarx.cloudfunctions.net/syncStoreOnDemand
```
