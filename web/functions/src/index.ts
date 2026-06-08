import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { rpc, scValToNative, TransactionBuilder, Transaction, Keypair } from '@stellar/stellar-sdk';
import { createHash } from 'crypto';

interface AuthPayload {
  walletAddress: string;
  timestamp: number;
  action: string;
  data?: {
    role?: 'merchant' | 'customer';
    fullName?: string;
  };
}

initializeApp();
const db = getFirestore();

// Set global region to Singapore (south-east asia 1)
setGlobalOptions({ region: 'asia-southeast1' });

// In a real production setup, load this from config or environment variables
const RPC_URL = 'https://soroban-testnet.stellar.org';
const REGISTRY_CONTRACT_ID = process.env.REGISTRY_CONTRACT_ID || 'CDFDBCIKFPE7QCH6RQG5IXB4UWGLPF7U2W2YKIHYJQZLWSXQ7T74BJCJ';
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = scValToNative(ev.value) as any;
        if (!data) continue;
        
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
        } catch (err) {
          console.error(`Error querying user profile for owner ${owner}:`, err);
        }
        
        await db.doc(`stores/${owner}`).set({
          owner,
          name,
          lat,
          lng,
          ownerName,
          syncedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        console.log(`Synced store: ${name} (${owner}) with ownerName: ${ownerName}`);
        
      } else if (eventName === 'StoreDeregistered') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = scValToNative(ev.value) as any;
        if (!data) continue;
        
        const owner = typeof data === 'string' ? data : (data.owner || data[0]);
        if (!owner) continue;

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
        } catch (err) {
          console.error(`Error clearing linkedWallet for owner ${owner}:`, err);
        }

        // 2. Recursively delete the store document and all its subcollections (products, receipts, etc.)
        try {
          const storeRef = db.doc(`stores/${owner}`);
          await db.recursiveDelete(storeRef);
          console.log(`Recursively deleted store and all subcollections for: ${owner}`);
        } catch (err) {
          console.error(`Error recursively deleting store for owner ${owner}:`, err);
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
}

export const syncStores = onSchedule('every 1 minutes', async () => {
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
    // Trigger sync
    await performStoreSync();
    
    res.status(200).json({ success: true, message: 'Sync complete' });
  } catch (error) {
    console.error('Error during on-demand store sync:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * Helper to verify a signed payload using Stellar transaction memo hash
 */
function verifyPayloadSignature(payload: AuthPayload, signedXdr: string): boolean {
  try {
    const payloadStr = JSON.stringify(payload);
    const hash = createHash('sha256').update(payloadStr).digest();

    const tx = TransactionBuilder.fromXDR(signedXdr, 'Test SDF Network ; September 2015') as Transaction;
    
    // Check timestamp to prevent old replay attacks (5 minute window)
    if (!payload.timestamp || Date.now() - payload.timestamp > 5 * 60 * 1000) {
      console.error('Payload timestamp expired or missing');
      return false;
    }

    // Verify memo matches payload hash
    if (tx.memo.type !== 'hash') {
      console.error('Memo type is not hash');
      return false;
    }
    
    const txMemoHash = tx.memo.value as Buffer;
    if (!txMemoHash.equals(hash)) {
      console.error('Memo hash does not match payload hash');
      return false;
    }

    // Verify signature
    const walletAddress = payload.walletAddress;
    const keypair = Keypair.fromPublicKey(walletAddress);
    let verified = false;
    for (const sig of tx.signatures) {
      if (keypair.verify(tx.hash(), sig.signature())) {
        verified = true;
        break;
      }
    }

    return verified;
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

/**
 * Endpoint to securely write a user profile without Firebase Auth
 */
export const secureWriteProfile = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  try {
    const { payload, signedXdr } = req.body;
    if (!payload || !signedXdr) {
      res.status(400).json({ error: 'Missing payload or signedXdr' });
      return;
    }

    if (!verifyPayloadSignature(payload, signedXdr)) {
      res.status(401).json({ error: 'Invalid signature or expired payload' });
      return;
    }

    const { walletAddress, action, data } = payload;
    
    if (action !== 'createProfile' && action !== 'updateProfile') {
      res.status(400).json({ error: 'Invalid action' });
      return;
    }

    const userDocRef = db.doc(`users/${walletAddress}`);
    
    if (action === 'createProfile') {
      const userProfile = {
        email: null,
        role: data.role,
        fullName: data.fullName,
        linkedWallet: walletAddress,
        createdAt: Date.now(),
      };
      await userDocRef.set(userProfile);
    } else if (action === 'updateProfile') {
      await userDocRef.update({ fullName: data.fullName });
      
      // If merchant, sync ownerName to store
      const userSnap = await userDocRef.get();
      if (userSnap.exists && userSnap.data()?.role === 'merchant') {
        const storeDocRef = db.doc(`stores/${walletAddress}`);
        const storeSnap = await storeDocRef.get();
        if (storeSnap.exists) {
          await storeDocRef.update({ ownerName: data.fullName });
        }
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in secureWriteProfile:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * Endpoint to securely delete a user account without Firebase Auth
 */
export const secureDeleteAccount = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  try {
    const { payload, signedXdr } = req.body;
    if (!payload || !signedXdr) {
      res.status(400).json({ error: 'Missing payload or signedXdr' });
      return;
    }

    if (!verifyPayloadSignature(payload, signedXdr)) {
      res.status(401).json({ error: 'Invalid signature or expired payload' });
      return;
    }

    const { walletAddress, action } = payload;
    if (action !== 'deleteAccount') {
      res.status(400).json({ error: 'Invalid action' });
      return;
    }

    const userDocRef = db.doc(`users/${walletAddress}`);
    const userSnap = await userDocRef.get();
    
    if (!userSnap.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    const profile = userSnap.data();

    // 1. Cascade delete
    if (profile?.role === 'customer') {
      const purchasesSnap = await db.collection('purchases').where('uid', '==', walletAddress).get();
      const batch = db.batch();
      purchasesSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    if (profile?.role === 'merchant') {
      await db.recursiveDelete(db.doc(`stores/${walletAddress}`));
      
      const legacyProductsSnap = await db.collection('products').where('uid', '==', walletAddress).get();
      const batch1 = db.batch();
      legacyProductsSnap.docs.forEach(d => batch1.delete(d.ref));
      await batch1.commit();

      const legacyReceiptsSnap = await db.collection('receipts').where('uid', '==', walletAddress).get();
      const batch2 = db.batch();
      legacyReceiptsSnap.docs.forEach(d => batch2.delete(d.ref));
      await batch2.commit();
    }

    // 2. Delete user profile
    await userDocRef.delete();

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in secureDeleteAccount:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
