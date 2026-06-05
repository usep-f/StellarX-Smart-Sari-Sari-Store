import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  Account,
  rpc,
  nativeToScVal,
  scValToNative,
} from '@stellar/stellar-sdk';
import { server, NETWORK_PASSPHRASE, REGISTRY_CONTRACT_ID } from './stellar';

const READ_SOURCE = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

export interface Store {
  owner: string;
  name: string;
  lat: number;
  lng: number;
}

export function registryConfigured(): boolean {
  return Boolean(REGISTRY_CONTRACT_ID);
}

/** Fetch all stores from the smart contract */
export async function getAllStores(): Promise<Store[]> {
  if (!registryConfigured()) return [];

  const contract = new Contract(REGISTRY_CONTRACT_ID);
  const source = new Account(READ_SOURCE, '0');

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('get_all_stores'))
    .setTimeout(30)
    .build();

  try {
    const sim = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
      console.error('Simulation failed for get_all_stores:', sim);
      return [];
    }

    const rawStores = scValToNative(sim.result.retval) as Array<{
      owner: string;
      name: string;
      lat: number;
      lng: number;
    }>;

    if (!Array.isArray(rawStores)) return [];

    return rawStores.map((s) => ({
      owner: s.owner,
      name: s.name,
      lat: Number(s.lat) / 1000000,
      lng: Number(s.lng) / 1000000,
    }));
  } catch (err) {
    console.error('Error fetching stores from contract:', err);
    return [];
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
