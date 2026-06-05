# Sari-Stellar POS & Map

A decentralized Point-of-Sale (PoS) system and discovery map designed for sari-sari stores in the Philippines, operating entirely on the Stellar Testnet.

---

## Idea
- **Track**: Financial Inclusion / Social Impact / Open
- **Idea # (from the 300-ideas list, if any)**: N/A (Custom Idea)
- **One-liner**: A smart sari-sari store application that uses a Soroban smart contract to map Stellar-enabled stores, and facilitates QR-code based instant POS payments on the Stellar network.

---

## Problem
In the Philippines, sari-sari stores (neighborhood convenience stores) are the backbone of local retail, accounting for over 70% of retail transactions. However, these cash-only micro-businesses face issues like:
1. **Lack of Digital Infrastructure**: Small owners cannot afford traditional card terminal POS setups.
2. **Lack of Discovery**: Customers cannot easily locate shops that support digital or cashless payments.
3. **No Financial Record-Keeping**: Manual cash boxes make tracking profits and transaction history tedious and prone to errors.

Sari-Stellar empowers these micro-merchants with a free, mobile-first, decentralized POS system requiring zero setup fees, while enabling local discovery via an on-chain store registry.

---

## How it uses Stellar
Stellar is the absolute core of our product:
1. **Decentralized Discovery (Soroban Contract)**: We deployed a Rust smart contract (`sari-sari-registry`) on the Stellar Testnet. Merchants register their store name and GPS coordinates on-chain. The homepage map queries this contract directly using simulation (read-only) to locate nearby stores.
2. **Instant Settlement (Native XLM Payments)**: Purchase payments are settled peer-to-peer from the buyer's wallet (Freighter) directly to the store owner's address. Transactions are settled in under 5 seconds with negligible fees.
3. **Blockchain-Powered Sync (Horizon API)**: The POS checkout screen generates a payment request with a unique reference memo. The merchant's dashboard monitors payments to their address using Horizon. As soon as the customer signs and submits the transaction, the merchant's screen detects the matching memo on-chain and automatically updates to show the receipt.
4. **Instant Onboarding (Stellar Friendbot)**: Allows new merchants and customers to request testnet XLM directly inside the app to start playing immediately.

---

## What works in the demo
- [x] **Connect wallet**: Connect Freighter wallet on testnet for both Merchant and Customer.
- [x] **On-chain Registration**: Store owners can register their shop name and GPS coordinates (extracted via browser Geolocation or Map Pin) onto the Soroban contract.
- [x] **Store Discovery Map**: Landing page maps all registered stores from the Soroban contract.
- [x] **Product Inventory & Barcodes**: Store owners can add/manage products, generating QR barcodes for each product ID.
- [x] **QR POS Shopping Cart**: Merchants can scan product QR codes using their camera (or desktop dropdown simulator) to add items to a virtual cart.
- [x] **Dynamic QR Invoices**: Generates a checkout payment QR code representing a secure customer payment URL.
- [x] **Freighter Wallet Signing**: Customer scans invoice QR, connects Freighter, reviews details, and pays.
- [x] **On-Chain Real-Time Receipt Sync**: Merchant and Customer screens automatically update to show transaction receipts as soon as the XLM clears on-chain.

---

## Setup / run
How a judge runs it locally:

### 1. Prerequisites
- Rust, Cargo, and target `wasm32v1-none`
- Stellar CLI (verify via `stellar --version`)
- Freighter Browser Extension (installed and set to **Test Net** network)

### 2. Smart Contract Deployment
From the project root directory, run the PowerShell script to build, deploy, and configure the registry contract ID:
```powershell
.\scripts\deploy-registry.ps1
```
*(This will automatically compile the Rust contract, upload it to Testnet, and write the resulting contract ID into `web/.env.local`)*

### 3. Run Web App
Navigate to the web folder, install packages, and launch the dev server:
```bash
cd web
npm install
npm run dev
```
Open `http://localhost:3000` in your browser. Open a second window/tab to simulate the customer payment flow!
