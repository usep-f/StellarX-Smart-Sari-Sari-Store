import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { rpc, scValToNative } from '@stellar/stellar-sdk';

initializeApp();
const db = getFirestore();

// In a real production setup, load this from config or environment variables
const RPC_URL = 'https://soroban-testnet.stellar.org';
const REGISTRY_CONTRACT_ID = process.env.REGISTRY_CONTRACT_ID || 'CAMXJESIHLZRZR2MCHN7BYFSEUO7YY2EFQ3ATJE2QRTYIKEPEZRYK65U';
const INITIAL_LEDGER = 4321000;

const server = new rpc.Server(RPC_URL);

export const syncStores = onSchedule('every 12 hours', async () => {
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
        if (!topics || topics.length === 0) continue;
        
        const eventName = scValToNative(topics[0]);
        
        if (eventName === 'StoreRegistered') {
          const data = scValToNative(ev.value) as Record<string, unknown>;
          if (!data) continue;
          
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
            syncedAt: FieldValue.serverTimestamp(),
          });
          console.log(`Synced store: ${name} (${owner}) under manager: ${manager}`);
          
        } else if (eventName === 'StoreDeregistered') {
          const owner = scValToNative(ev.value) as string;
          if (!owner) continue;
          
          // Use collectionGroup query to find and delete the store regardless of manager
          const snapshot = await db.collectionGroup('stores').where('owner', '==', owner).get();
          const deletions = snapshot.docs.map(doc => doc.ref.delete());
          await Promise.all(deletions);
          
          console.log(`Deregistered store of: ${owner}`);
        } else if (eventName === 'ManagerUpdated') {
          const data = scValToNative(ev.value) as Record<string, unknown>;
          if (!data) continue;
          
          const owner = data.owner;
          const newManager = data.manager;
          
          const snapshot = await db.collectionGroup('stores').where('owner', '==', owner).get();
          if (!snapshot.empty) {
            const oldDoc = snapshot.docs[0];
            const storeData = oldDoc.data();
            
            const newPath = `merchants/${newManager}/stores/${owner}`;
            
            if (oldDoc.ref.path !== newPath) {
               await db.doc(newPath).set({
                 ...storeData,
                 manager: newManager,
                 syncedAt: FieldValue.serverTimestamp(),
               });
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
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    
    console.log(`Sync complete up to ledger ${latestLedger}`);
  } catch (error) {
    console.error('Error during store sync:', error);
  }
});

export const syncStoreTx = onCall(async (request) => {
  // 1. Auth Validation
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to sync transactions.');
  }

  const { txHash } = request.data;
  if (!txHash || typeof txHash !== 'string') {
    throw new HttpsError('invalid-argument', 'A valid txHash string is required.');
  }

  try {
    // 2. Fetch Transaction
    const txResponse = await server.getTransaction(txHash);
    if (txResponse.status !== 'SUCCESS') {
       throw new HttpsError('failed-precondition', `Transaction status is ${txResponse.status}`);
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
        if (ev.txHash !== txHash) continue;
        
        const topics = ev.topic;
        if (!topics || topics.length === 0) continue;
        
        const eventName = scValToNative(topics[0]);
        
        if (eventName === 'StoreRegistered') {
          const data = scValToNative(ev.value) as Record<string, unknown>;
          if (!data) continue;
          
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
            syncedAt: FieldValue.serverTimestamp(),
          });
          console.log(`Callable synced store: ${name} (${owner}) under manager: ${manager}`);
          processedCount++;
          
        } else if (eventName === 'StoreDeregistered') {
          const owner = scValToNative(ev.value) as string;
          if (!owner) continue;
          
          const snapshot = await db.collectionGroup('stores').where('owner', '==', owner).get();
          const deletions = snapshot.docs.map(doc => doc.ref.delete());
          await Promise.all(deletions);
          console.log(`Callable deregistered store of: ${owner}`);
          processedCount++;
          
        } else if (eventName === 'ManagerUpdated') {
          const data = scValToNative(ev.value) as Record<string, unknown>;
          if (!data) continue;
          
          const owner = data.owner;
          const newManager = data.manager;
          
          const snapshot = await db.collectionGroup('stores').where('owner', '==', owner).get();
          if (!snapshot.empty) {
             const oldDoc = snapshot.docs[0];
             const storeData = oldDoc.data();
             const newPath = `merchants/${newManager}/stores/${owner}`;
             
             if (oldDoc.ref.path !== newPath) {
                await db.doc(newPath).set({
                  ...storeData,
                  manager: newManager,
                  syncedAt: FieldValue.serverTimestamp(),
                });
                await oldDoc.ref.delete();
                console.log(`Callable updated manager for store ${owner} to ${newManager}`);
             }
          }
          processedCount++;
        }
      }
    }

    return { success: true, processedCount };
  } catch (error: any) {
    console.error('Error syncing store tx:', error);
    if (error instanceof HttpsError) {
       throw error;
    }
    throw new HttpsError('internal', 'An error occurred while syncing the transaction.');
  }
});

