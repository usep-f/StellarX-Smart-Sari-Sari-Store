import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { rpc, scValToNative } from '@stellar/stellar-sdk';

initializeApp();
const db = getFirestore();

// Set global region to Singapore (south-east asia 1)
setGlobalOptions({ region: 'asia-southeast1' });

// In a real production setup, load this from config or environment variables
const RPC_URL = 'https://soroban-testnet.stellar.org';
const REGISTRY_CONTRACT_ID = process.env.REGISTRY_CONTRACT_ID || 'CDN5MATSIOYZPAUNGKLORF6LVHJKTFGG4LBPC2BKNFBEQ2CLNH2G3LRX';
const INITIAL_LEDGER = 4321000;

const server = new rpc.Server(RPC_URL);

/**
 * Shared helper to perform registry sync from the blockchain to Firestore
 */
async function performStoreSync(): Promise<void> {
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
  } else {
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
}

export const syncStores = onSchedule('every 1 minutes', async (event) => {
  try {
    await performStoreSync();
  } catch (error) {
    console.error('Error during scheduled store sync:', error);
  }
});

export const syncStoreOnDemand = onRequest(async (req, res) => {
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
      await getAuth().verifyIdToken(token);
    } catch (authError) {
      console.error('Auth token verification failed:', authError);
      res.status(401).json({ error: 'Unauthorized: Invalid ID token' });
      return;
    }

    // Trigger sync
    await performStoreSync();
    
    res.status(200).json({ success: true, message: 'Sync complete' });
  } catch (error) {
    console.error('Error during on-demand store sync:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
