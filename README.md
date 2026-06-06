# Sari-Stellar POS & Map

A decentralized Point-of-Sale (PoS) system and discovery map designed for local sari-sari stores in the Philippines, operating entirely on the Stellar Testnet.

## Problem
In the Philippines, sari-sari stores (neighborhood convenience stores) are the backbone of local retail, accounting for over 70% of retail transactions. However, these cash-only micro-businesses face issues like:
1. **Lack of Digital Infrastructure**: Small owners cannot afford traditional card terminal POS setups due to setup costs and transactional fees.
2. **Lack of Discovery**: Customers cannot easily locate shops that support digital or cashless payments.
3. **No Financial Record-Keeping**: Manual cash boxes make tracking profits and transaction history tedious and prone to errors.

Sari-Stellar empowers these micro-merchants with a free, mobile-first, decentralized POS system requiring zero setup fees, while enabling local discovery via an on-chain store registry.

## How It Works
The application supports two primary user flows:

- **For Merchants (Store Owners)**:
  1. **Connect & Register**: Connect their Freighter wallet and register their store on the Stellar blockchain with their shop name and GPS coordinates (extracted via browser geolocation or map pin).
  2. **Inventory Management**: Add products to their store inventory, automatically generating unique product QR codes/barcodes.
  3. **POS Checkout**: Add items to a virtual shopping cart by scanning product QR codes (using a webcam or mobile camera).
  4. **Receive Payment**: Generate a checkout payment QR code containing the transaction amount and a unique reference memo.
  5. **On-Chain Sync**: The merchant dashboard automatically listens to the blockchain, instantly confirming the payment and showing a receipt once the customer submits it.

- **For Customers**:
  1. **Store Discovery**: Use the interactive store map to locate registered Stellar-enabled sari-sari stores nearby.
  2. **Scan & Pay**: Scan the checkout QR code at a store, connect their Freighter wallet, review payment details, and authorize the transaction.
  3. **Instant Settlement**: XLM is transferred directly to the merchant's address in under 5 seconds with near-zero network fees.

## How It Uses Stellar
Stellar is the absolute core of Sari-Stellar:
1. **Decentralized Store Registry (Soroban Smart Contract)**: A Rust smart contract (`sari-sari-registry`) deployed on the Stellar Testnet. Merchants register their store coordinates on-chain, and the discovery map queries the contract directly using simulation (read-only) to locate nearby stores.
2. **Instant Settlement (Native XLM Payments)**: Purchase payments are settled peer-to-peer from the customer's Freighter wallet directly to the store owner's address. Transactions are settled in under 5 seconds with negligible fees.
3. **Blockchain-Powered Sync (Horizon API)**: The checkout screen generates a payment request with a unique reference memo. The merchant's dashboard monitors payments to their address using Horizon. As soon as the customer signs and submits the transaction, the merchant's screen detects the matching memo on-chain and automatically updates to show the receipt.
4. **Instant Onboarding (Stellar Friendbot)**: Seamless onboarding allowing new merchants and customers to request testnet XLM directly inside the app to start transacting immediately.

## Track
Financial Inclusion & Social Impact / Open Track

## Tech Stack
- Framework: Next.js 16.2.6 (React 19.2.4, TailwindCSS v4)
- Stellar SDK: `@stellar/stellar-sdk` v15.1.0 and `@stellar/freighter-api` v6.0.1
- Network: Testnet
- Key Dependencies:
  - `firebase` v12.14.0 (Cloud Firestore for product inventory storage/sync)
  - `leaflet` v1.9.4 & `@types/leaflet` (for interactive map and store discovery)
  - `html5-qrcode` v2.3.8 (for scanning product barcodes and payment QR codes)
  - `qrcode.react` v4.2.0 (for generating product and invoice QR codes)
  - `framer-motion` v12.40.0 (for smooth UI animations)

## Setup & Run
### Prerequisites
- Node.js 20+ and npm
- Freighter Browser Extension (installed and set to **Test Net**)
- Rust, Cargo, target `wasm32v1-none`, and Stellar CLI (only required if deploying/modifying the smart contract)

### Step-by-Step Run Instructions
```bash
# 1. Clone the repository
git clone https://github.com/usep-f/StellarX-Smart-Sari-Sari-Store.git
cd StellarX-Smart-Sari-Sari-Store

# 2. Build & Deploy the smart contract (optional)
# If you are on Windows, run the PowerShell script to build, deploy, and configure the contract:
.\scripts\deploy-registry.ps1
# (This compiles the Rust contract, uploads it to Testnet, and writes the resulting contract ID to web/.env.local)

# 3. Setup the Frontend
cd web
npm install

# 4. Configure Environment Variables
# The deploy-registry script automatically populates web/.env.local, but you can manually verify/edit it:
#   NEXT_PUBLIC_REGISTRY_CONTRACT_ID=CDZEWZG3AHI4DFTD6O2AQE77JPDBQDAT7XJJYUWCWAS5G3FVCLH3CN33
#   NEXT_PUBLIC_FIREBASE_API_KEY=...
#   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
#   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
#   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
#   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
#   NEXT_PUBLIC_FIREBASE_APP_ID=...

# 5. Run the web application
npm run dev
```
Open `http://localhost:3000` in your browser. Open a second window/tab to simulate the customer payment flow!

## Network Details
- Network: Stellar Testnet
- RPC URL: `https://soroban-testnet.stellar.org`
- Contract IDs:
  - Registry Contract: `CDZEWZG3AHI4DFTD6O2AQE77JPDBQDAT7XJJYUWCWAS5G3FVCLH3CN33`
- Asset issuers: Native XLM

## Team
- Joseph Umali — @usep-f

## License
MIT License
