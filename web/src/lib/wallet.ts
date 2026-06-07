import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit';
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils';

let isInitialized = false;

export const getKit = () => {
  if (typeof window === 'undefined') return null;
  if (!isInitialized) {
    StellarWalletsKit.init({
      modules: defaultModules(),
    });
    isInitialized = true;
  }
  return StellarWalletsKit;
};
