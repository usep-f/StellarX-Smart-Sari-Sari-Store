## Project Name
Sari-Stellar

## One-Line Description
A smart sari-sari store application that uses a Soroban smart contract to map Stellar-enabled stores, and facilitates QR-code based instant POS payments on the Stellar network.

## Track
Track 2 Financial Inclusion & Everyday Payments

## Problem It Solves
Sari-sari stores represent over 70% of retail transactions in the Philippines but remain cash-only due to the high cost and complexity of traditional card terminal POS setups. This cash-only model prevents micro-merchants from building a digital credit/sales history and limits their discovery to physical foot traffic. Sari-Stellar addresses this by providing a free, mobile-first, decentralized POS registry and instant payment settlement system with zero setup fees, empowering micro-merchants to accept digital payments and get discovered.

## How It Uses Stellar
- **Soroban Smart Contract**: We deployed the `sari-sari-registry` Rust contract on the Stellar Testnet. This on-chain registry holds names and GPS coordinates of stores. The map client queries the contract via read-only simulation to list stores.
- **Native XLM Payments**: Payments are peer-to-peer, transferring native XLM directly from the customer's Freighter wallet to the merchant's address. Settlement takes under 5 seconds with negligible network fees.
- **Horizon Transaction Monitoring**: We use Horizon to monitor incoming transactions in real-time. The POS checkout generates a unique payment reference (memo), and the merchant dashboard monitors the address via Horizon, automatically displaying a receipt when the matching memo is committed on-chain.
- **Stellar Friendbot Integration**: Built-in Friendbot faucet allows users to instantly fund testnet accounts to try the demo immediately.

## GitHub Repository
https://github.com/usep-f/StellarX-Smart-Sari-Sari-Store

## Network & Deployment
- Network: testnet
- Live app URL (if any): runs locally — see README
- Contract IDs / asset issuers (if any):
  - Registry Contract ID: `CDZEWZG3AHI4DFTD6O2AQE77JPDBQDAT7XJJYUWCWAS5G3FVCLH3CN33`

## Team
- Joseph Umali — @usep-f

## Novelty Note (optional, for bonus points)
Sari-Stellar bridges on-chain discovery (mapping physical stores using smart contracts) with off-chain retail operations (POS, inventory management, and QR invoices). While typical crypto POS systems are pure payment portals, Sari-Stellar embeds local geolocation mapping directly on-chain through a Soroban smart contract registry. This allows decentralized discovery of digital-ready brick-and-mortar stores, targeting the unbanked and underbanked sari-sari store sector in the Philippines.

## Anything Else
- **Future Roadmap**: We plan to support USDC on Stellar (via Stellar Asset Contract trustlines) to shield micro-merchants from price volatility, integrate multi-signature shared store wallets for partners/co-owners, and incorporate decentralized inventory storage (such as IPFS/Arweave).
