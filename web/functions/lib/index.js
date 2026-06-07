"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncStores = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const stellar_sdk_1 = require("@stellar/stellar-sdk");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
// In a real production setup, load this from config or environment variables
const RPC_URL = 'https://soroban-testnet.stellar.org';
const REGISTRY_CONTRACT_ID = process.env.REGISTRY_CONTRACT_ID || 'CDZEWZG3AHI4DFTD6O2AQE77JPDBQDAT7XJJYUWCWAS5G3FVCLH3CN33';
const INITIAL_LEDGER = 4321000;
const server = new stellar_sdk_1.rpc.Server(RPC_URL);
exports.syncStores = (0, scheduler_1.onSchedule)('every 1 minutes', async () => {
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
//# sourceMappingURL=index.js.map