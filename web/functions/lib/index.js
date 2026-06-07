"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAuthChallenge = exports.getAuthChallenge = exports.syncStoreOnDemand = exports.syncStores = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const stellar_sdk_1 = require("@stellar/stellar-sdk");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
// Set global region to Singapore (south-east asia 1)
(0, v2_1.setGlobalOptions)({ region: 'asia-southeast1' });
// In a real production setup, load this from config or environment variables
const RPC_URL = 'https://soroban-testnet.stellar.org';
const REGISTRY_CONTRACT_ID = process.env.REGISTRY_CONTRACT_ID || 'CDN5MATSIOYZPAUNGKLORF6LVHJKTFGG4LBPC2BKNFBEQ2CLNH2G3LRX';
const INITIAL_LEDGER = 4321000;
const server = new stellar_sdk_1.rpc.Server(RPC_URL);
/**
 * Shared helper to perform registry sync from the blockchain to Firestore
 */
async function performStoreSync() {
    const configRef = db.doc('config/indexer');
    const configDoc = await configRef.get();
    const latestLedgerRes = await server.getLatestLedger();
    const latestLedger = latestLedgerRes.sequence;
    let startLedger = INITIAL_LEDGER;
    if (configDoc.exists) {
        const data = configDoc.data();
        if (data && data.lastProcessedLedger) {
            startLedger = data.lastProcessedLedger;
        }
    }
    else {
        // If first-time initialization, default to 100 ledgers ago to sync quickly
        startLedger = Math.max(1, latestLedger - 100);
        console.log(`No config found. Initializing startLedger to ${startLedger}`);
    }
    // Handle ledger sequence rollbacks (e.g. testnet reset) or config in the future
    if (startLedger > latestLedger) {
        console.log(`Detected ledger sequence rollback (network reset). Resetting startLedger from ${startLedger} to ${latestLedger - 100}`);
        startLedger = Math.max(1, latestLedger - 100);
    }
    if (startLedger >= latestLedger) {
        console.log('Already synced to latest ledger.');
        return;
    }
    console.log(`Syncing from ledger ${startLedger} to ${latestLedger}...`);
    // Retrieve events
    const eventsResponse = await server.getEvents({
        startLedger: startLedger,
        filters: [
            {
                type: 'contract',
                contractIds: [REGISTRY_CONTRACT_ID]
            }
        ]
    });
    if (eventsResponse.events) {
        for (const ev of eventsResponse.events) {
            const topics = ev.topic;
            if (!topics || topics.length === 0)
                continue;
            const eventName = (0, stellar_sdk_1.scValToNative)(topics[0]);
            if (eventName === 'StoreRegistered') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = (0, stellar_sdk_1.scValToNative)(ev.value);
                if (!data)
                    continue;
                // Depending on Soroban SDK versions, structs might be returned as arrays of values
                // or objects. We handle the object format based on stellar-sdk behavior:
                const owner = data.owner;
                const name = data.name;
                const lat = Number(data.lat) / 1000000;
                const lng = Number(data.lng) / 1000000;
                // Query the users collection to see if a merchant has already linked this wallet.
                // If they have, we can populate the ownerName field immediately.
                let ownerName = 'Pending Link';
                try {
                    const usersRef = db.collection('users');
                    const querySnap = await usersRef.where('linkedWallet', '==', owner).limit(1).get();
                    if (!querySnap.empty) {
                        const userData = querySnap.docs[0].data();
                        if (userData && userData.fullName) {
                            ownerName = userData.fullName;
                        }
                    }
                }
                catch (err) {
                    console.error(`Error querying user profile for owner ${owner}:`, err);
                }
                await db.doc(`stores/${owner}`).set({
                    owner,
                    name,
                    lat,
                    lng,
                    ownerName,
                    syncedAt: firestore_1.FieldValue.serverTimestamp(),
                }, { merge: true });
                console.log(`Synced store: ${name} (${owner}) with ownerName: ${ownerName}`);
            }
            else if (eventName === 'StoreDeregistered') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = (0, stellar_sdk_1.scValToNative)(ev.value);
                if (!data)
                    continue;
                const owner = typeof data === 'string' ? data : (data.owner || data[0]);
                if (!owner)
                    continue;
                // 1. Clear linkedWallet in users collection for matching owners
                try {
                    const usersRef = db.collection('users');
                    const querySnap = await usersRef.where('linkedWallet', '==', owner).get();
                    if (!querySnap.empty) {
                        const batch = db.batch();
                        querySnap.forEach((userDoc) => {
                            batch.update(userDoc.ref, { linkedWallet: null });
                        });
                        await batch.commit();
                        console.log(`Cleared linkedWallet for ${querySnap.size} user(s) matching owner: ${owner}`);
                    }
                }
                catch (err) {
                    console.error(`Error clearing linkedWallet for owner ${owner}:`, err);
                }
                // 2. Recursively delete the store document and all its subcollections (products, receipts, etc.)
                try {
                    const storeRef = db.doc(`stores/${owner}`);
                    await db.recursiveDelete(storeRef);
                    console.log(`Recursively deleted store and all subcollections for: ${owner}`);
                }
                catch (err) {
                    console.error(`Error recursively deleting store for owner ${owner}:`, err);
                }
            }
        }
    }
    // Update last processed ledger
    await configRef.set({
        lastProcessedLedger: latestLedger,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`Sync complete up to ledger ${latestLedger}`);
}
exports.syncStores = (0, scheduler_1.onSchedule)('every 1 minutes', async () => {
    try {
        await performStoreSync();
    }
    catch (error) {
        console.error('Error during scheduled store sync:', error);
    }
});
exports.syncStoreOnDemand = (0, https_1.onRequest)(async (req, res) => {
    // Handle CORS
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.status(204).send('');
        return;
    }
    try {
        // Authenticate the user calling the endpoint
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
            return;
        }
        const token = authHeader.split('Bearer ')[1];
        try {
            await (0, auth_1.getAuth)().verifyIdToken(token);
        }
        catch (authError) {
            console.error('Auth token verification failed:', authError);
            res.status(401).json({ error: 'Unauthorized: Invalid ID token' });
            return;
        }
        // Trigger sync
        await performStoreSync();
        res.status(200).json({ success: true, message: 'Sync complete' });
    }
    catch (error) {
        console.error('Error during on-demand store sync:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
/**
 * Endpoint to generate a random challenge nonce and wrap it in an unsigned mock transaction XDR
 */
exports.getAuthChallenge = (0, https_1.onRequest)(async (req, res) => {
    // Handle CORS
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }
    try {
        const { walletAddress } = req.body;
        if (!walletAddress) {
            res.status(400).json({ error: 'Missing walletAddress' });
            return;
        }
        // 1. Generate challenge nonce
        const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
        // 2. Save challenge in Firestore
        await db.doc(`challenges/${walletAddress}`).set({
            nonce,
            expiresAt,
        });
        // 3. Build offline unsigned Stellar Transaction
        const account = new stellar_sdk_1.Account(walletAddress, '0');
        const tx = new stellar_sdk_1.TransactionBuilder(account, {
            fee: '100',
            networkPassphrase: 'Test SDF Network ; September 2015',
        })
            .addMemo(stellar_sdk_1.Memo.text(nonce))
            .addOperation(stellar_sdk_1.Operation.bumpSequence({ bumpTo: '1' }))
            .setTimeout(300) // 5 minutes
            .build();
        const unsignedXdr = tx.toXDR();
        res.status(200).json({ success: true, nonce, unsignedXdr });
    }
    catch (error) {
        console.error('Error generating challenge:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
/**
 * Endpoint to verify signed XDR challenge and issue a Firebase Custom Auth token
 */
exports.verifyAuthChallenge = (0, https_1.onRequest)(async (req, res) => {
    var _a;
    // Handle CORS
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }
    try {
        const { signedXdr, walletAddress } = req.body;
        if (!signedXdr || !walletAddress) {
            res.status(400).json({ error: 'Missing signedXdr or walletAddress' });
            return;
        }
        // 1. Retrieve the stored challenge
        const challengeRef = db.doc(`challenges/${walletAddress}`);
        const challengeSnap = await challengeRef.get();
        if (!challengeSnap.exists) {
            res.status(400).json({ error: 'Challenge not found. Please request login again.' });
            return;
        }
        const { nonce, expiresAt } = challengeSnap.data();
        if (Date.now() > expiresAt) {
            await challengeRef.delete();
            res.status(400).json({ error: 'Challenge expired. Please request login again.' });
            return;
        }
        // 2. Decode the transaction and check parameters
        const tx = stellar_sdk_1.TransactionBuilder.fromXDR(signedXdr, 'Test SDF Network ; September 2015');
        // 3. Verify memo contains the correct nonce
        const txMemo = (_a = tx.memo.value) === null || _a === void 0 ? void 0 : _a.toString();
        if (txMemo !== nonce) {
            res.status(400).json({ error: 'Invalid challenge memo.' });
            return;
        }
        // 4. Verify transaction signature
        const keypair = stellar_sdk_1.Keypair.fromPublicKey(walletAddress);
        let verified = false;
        for (const sig of tx.signatures) {
            if (keypair.verify(tx.hash(), sig.signature())) {
                verified = true;
                break;
            }
        }
        if (!verified) {
            res.status(400).json({ error: 'Invalid signature for this wallet address.' });
            return;
        }
        // 5. Cleanup challenge
        await challengeRef.delete();
        // 6. Create custom token
        const customToken = await (0, auth_1.getAuth)().createCustomToken(walletAddress);
        res.status(200).json({ success: true, customToken });
    }
    catch (error) {
        console.error('Error verifying challenge:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
    }
});
//# sourceMappingURL=index.js.map