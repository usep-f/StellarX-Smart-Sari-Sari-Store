import { NETWORK_PASSPHRASE } from './stellar';
import { submitSignedXDR, pollTransaction } from './payment';
import { getKit } from './wallet';

/**
 * Sign an unsigned XDR with Freighter, submit it, and poll to finality.
 * Returns the transaction hash. Use for simple "one-shot" actions
 * (trustlines, contract calls) that don't need granular status UI.
 */
export async function signAndSubmit(xdr: string): Promise<string> {
  const kit = getKit();
  if (!kit) throw new Error('Wallet kit not initialized');
  const { signedTxXdr } = await kit.signTransaction(xdr, { networkPassphrase: NETWORK_PASSPHRASE });
  const hash = await submitSignedXDR(signedTxXdr);
  await pollTransaction(hash);
  return hash;
}
