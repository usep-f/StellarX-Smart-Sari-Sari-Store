import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { rpc, scValToNative } from '@stellar/stellar-sdk';

initializeApp();
const db = getFirestore();

// In a real production setup, load this from config or environment variables
const RPC_URL = 'https://soroban-testnet.stellar.org';
const REGISTRY_CONTRACT_ID = process.env.REGISTRY_CONTRACT_ID || 'CDZEWZG3AHI4DFTD6O2AQE77JPDBQDAT7XJJYUWCWAS5G3FVCLH3CN33';
const INITIAL_LEDGER = 4321000;

const server = new rpc.Server(RPC_URL);

export const syncStores = onSchedule('every 1 minutes', async (event) => {
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
          const data = scValToNative(ev.value) as any;
          if (!data) continue;
          
          // Depending on Soroban SDK versions, structs might be returned as arrays of values
          // or objects. We handle the object format based on stellar-sdk behavior:
          const owner = data.owner;
          const name = data.name;
          const lat = Number(data.lat) / 1000000;
          const lng = Number(data.lng) / 1000000;
          
          await db.doc(`stores/${owner}`).set({
            owner,
            name,
            lat,
            lng,
            syncedAt: FieldValue.serverTimestamp(),
          });
          console.log(`Synced store: ${name} (${owner})`);
          
        } else if (eventName === 'StoreDeregistered') {
          const data = scValToNative(ev.value) as any;
          if (!data) continue;
          
          const owner = data.owner;
          await db.doc(`stores/${owner}`).delete();
          console.log(`Deregistered store of: ${owner}`);
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
