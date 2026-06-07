"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncStoreTx = exports.syncStores = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const stellar_sdk_1 = require("@stellar/stellar-sdk");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
// In a real production setup, load this from config or environment variables
const RPC_URL = 'https://soroban-testnet.stellar.org';
const REGISTRY_CONTRACT_ID = process.env.REGISTRY_CONTRACT_ID || 'CAL34EKITEK7K42XTV77YX5F3OHZITY4VXX722JKITKNFUB2CAY4C5V2';
const INITIAL_LEDGER = 4321000;
const server = new stellar_sdk_1.rpc.Server(RPC_URL);
exports.syncStores = (0, scheduler_1.onSchedule)('every 12 hours', async () => {
    try {
        const configRef = db.doc('config/indexer');
        const configDoc = await configRef.get();
        let startLedger = INITIAL_LEDGER;
        if (configDoc.exists) {
            const data = configDoc.data();
            if (data && data.lastProcessedLedger) {
                startLedger = data.lastProcessedLedger;
            }
        }
        const latestLedgerRes = await server.getLatestLedger();
        const latestLedger = latestLedgerRes.sequence;
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
                    const data = (0, stellar_sdk_1.scValToNative)(ev.value);
                    if (!data)
                        continue;
                    // Depending on Soroban SDK versions, structs might be returned as arrays of values
                    // or objects. We handle the object format based on stellar-sdk behavior:
                    const owner = data.owner;
                    const manager = data.manager || data.owner; // Default to owner if manager is missing (backwards compat)
                    const name = data.name;
                    const lat = Number(data.lat) / 1000000;
                    const lng = Number(data.lng) / 1000000;
                    await db.doc(`merchants/${manager}/stores/${owner}`).set({
                        owner,
                        manager,
                        name,
                        lat,
                        lng,
                        syncedAt: firestore_1.FieldValue.serverTimestamp(),
                    });
                    console.log(`Synced store: ${name} (${owner}) under manager: ${manager}`);
                }
                else if (eventName === 'StoreDeregistered') {
                    const owner = (0, stellar_sdk_1.scValToNative)(ev.value);
                    if (!owner)
                        continue;
                    // Use collectionGroup query to find and delete the store regardless of manager
                    const snapshot = await db.collectionGroup('stores').where('owner', '==', owner).get();
                    const deletions = snapshot.docs.map(doc => doc.ref.delete());
                    await Promise.all(deletions);
                    console.log(`Deregistered store of: ${owner}`);
                }
                else if (eventName === 'ManagerUpdated') {
                    const data = (0, stellar_sdk_1.scValToNative)(ev.value);
                    if (!data)
                        continue;
                    const owner = data.owner;
                    const newManager = data.manager;
                    const snapshot = await db.collectionGroup('stores').where('owner', '==', owner).get();
                    if (!snapshot.empty) {
                        const oldDoc = snapshot.docs[0];
                        const storeData = oldDoc.data();
                        const newPath = `merchants/${newManager}/stores/${owner}`;
                        if (oldDoc.ref.path !== newPath) {
                            await db.doc(newPath).set(Object.assign(Object.assign({}, storeData), { manager: newManager, syncedAt: firestore_1.FieldValue.serverTimestamp() }));
                            await oldDoc.ref.delete();
                            console.log(`Updated manager for store ${owner} to ${newManager}`);
                        }
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
    catch (error) {
        console.error('Error during store sync:', error);
    }
});
exports.syncStoreTx = (0, https_1.onCall)(async (request) => {
    // 1. Auth Validation
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated to sync transactions.');
    }
    const { txHash } = request.data;
    if (!txHash || typeof txHash !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'A valid txHash string is required.');
    }
    try {
        // 2. Fetch Transaction
        const txResponse = await server.getTransaction(txHash);
        if (txResponse.status !== 'SUCCESS') {
            throw new https_1.HttpsError('failed-precondition', `Transaction status is ${txResponse.status}`);
        }
        // 3. Fetch Events for that ledger
        const ledger = txResponse.ledger;
        const eventsResponse = await server.getEvents({
            startLedger: ledger,
            filters: [{ type: 'contract', contractIds: [REGISTRY_CONTRACT_ID] }]
        });
        let processedCount = 0;
        if (eventsResponse.events) {
            for (const ev of eventsResponse.events) {
                // Filter by the specific transaction hash
                if (ev.txHash !== txHash)
                    continue;
                const topics = ev.topic;
                if (!topics || topics.length === 0)
                    continue;
                const eventName = (0, stellar_sdk_1.scValToNative)(topics[0]);
                if (eventName === 'StoreRegistered') {
                    const data = (0, stellar_sdk_1.scValToNative)(ev.value);
                    if (!data)
                        continue;
                    const owner = data.owner;
                    const manager = data.manager || data.owner;
                    const name = data.name;
                    const lat = Number(data.lat) / 1000000;
                    const lng = Number(data.lng) / 1000000;
                    await db.doc(`merchants/${manager}/stores/${owner}`).set({
                        owner,
                        manager,
                        name,
                        lat,
                        lng,
                        syncedAt: firestore_1.FieldValue.serverTimestamp(),
                    });
                    console.log(`Callable synced store: ${name} (${owner}) under manager: ${manager}`);
                    processedCount++;
                }
                else if (eventName === 'StoreDeregistered') {
                    const owner = (0, stellar_sdk_1.scValToNative)(ev.value);
                    if (!owner)
                        continue;
                    const snapshot = await db.collectionGroup('stores').where('owner', '==', owner).get();
                    const deletions = snapshot.docs.map(doc => doc.ref.delete());
                    await Promise.all(deletions);
                    console.log(`Callable deregistered store of: ${owner}`);
                    processedCount++;
                }
                else if (eventName === 'ManagerUpdated') {
                    const data = (0, stellar_sdk_1.scValToNative)(ev.value);
                    if (!data)
                        continue;
                    const owner = data.owner;
                    const newManager = data.manager;
                    const snapshot = await db.collectionGroup('stores').where('owner', '==', owner).get();
                    if (!snapshot.empty) {
                        const oldDoc = snapshot.docs[0];
                        const storeData = oldDoc.data();
                        const newPath = `merchants/${newManager}/stores/${owner}`;
                        if (oldDoc.ref.path !== newPath) {
                            await db.doc(newPath).set(Object.assign(Object.assign({}, storeData), { manager: newManager, syncedAt: firestore_1.FieldValue.serverTimestamp() }));
                            await oldDoc.ref.delete();
                            console.log(`Callable updated manager for store ${owner} to ${newManager}`);
                        }
                    }
                    processedCount++;
                }
            }
        }
        return { success: true, processedCount };
    }
    catch (error) {
        console.error('Error syncing store tx:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', 'An error occurred while syncing the transaction.');
    }
});
//# sourceMappingURL=index.js.map