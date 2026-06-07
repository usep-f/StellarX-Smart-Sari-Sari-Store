import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  rpc,
  nativeToScVal,
} from '@stellar/stellar-sdk';
import { server, NETWORK_PASSPHRASE, REGISTRY_CONTRACT_ID } from './stellar';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface Store {
  owner: string;
  name: string;
  lat: number;
  lng: number;
  ownerName?: string;
}

export function registryConfigured(): boolean {
  return Boolean(REGISTRY_CONTRACT_ID);
}

/** Fetch all stores from Firestore (populated by indexer) */
export async function getAllStores(): Promise<Store[]> {
  try {
    const storesCol = collection(db, 'stores');
    const storeSnapshot = await getDocs(storesCol);
    return storeSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        owner: data.owner,
        name: data.name,
        lat: data.lat,
        lng: data.lng,
        ownerName: data.ownerName,
      } as Store;
    });
  } catch (err) {
    console.error('Error fetching stores from Firestore:', err);
    return [];
  }
}

/** Fetch a single store by owner from Firestore */
export async function getStore(owner: string): Promise<Store | null> {
  try {
    const docRef = doc(db, 'stores', owner);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        owner: data.owner,
        name: data.name,
        lat: data.lat,
        lng: data.lng,
        ownerName: data.ownerName,
      } as Store;
    }
    return null;
  } catch (err) {
    console.error('Error fetching store from Firestore:', err);
    return null;
  }
}

/** Build contribution transaction to register a store */
export async function buildRegisterStoreXDR(
  sender: string,
  name: string,
  lat: number,
  lng: number,
): Promise<string> {
  if (!registryConfigured()) {
    throw new Error('Registry contract ID is not configured');
  }

  const contract = new Contract(REGISTRY_CONTRACT_ID);
  const account = await server.getAccount(sender);

  // Convert float coordinates to scaled i32 integers
  const latInt = Math.round(lat * 1000000);
  const lngInt = Math.round(lng * 1000000);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'register_store',
        nativeToScVal(sender, { type: 'address' }),
        nativeToScVal(name, { type: 'string' }),
        nativeToScVal(latInt, { type: 'i32' }),
        nativeToScVal(lngInt, { type: 'i32' }),
      ),
    )
    .setTimeout(60)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    // Attempt to extract error message if possible
    console.error('Simulation failed for register_store:', sim);
    throw new Error('Registration simulation failed. Have you already registered a store?');
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

/** Build transaction to deregister a store */
export async function buildDeregisterStoreXDR(sender: string): Promise<string> {
  if (!registryConfigured()) {
    throw new Error('Registry contract ID is not configured');
  }

  const contract = new Contract(REGISTRY_CONTRACT_ID);
  const account = await server.getAccount(sender);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call('deregister_store', nativeToScVal(sender, { type: 'address' })),
    )
    .setTimeout(60)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    console.error('Simulation failed for deregister_store:', sim);
    throw new Error('Deregistration simulation failed. Do you own a registered store?');
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}
